// Sign-in and sync with the Kasku+ tables in Supabase Postgres (plain REST, no SDK).
// The device keeps a full copy for offline use; local changes queue in the store's dirty set.
import { useSyncExternalStore } from 'react';
import { store } from './store.js';

const SUPA_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const configured = Boolean(SUPA_URL && SUPA_KEY);
export const supabaseUrl = SUPA_URL;
export const supabaseKey = SUPA_KEY;

const CFG_KEY = 'kasku.v2.sync';
const PAGE = 1000;

// ---------- record kind <-> table mapping ----------
// [record field, column, conversion, default sent when the field is empty]
const time = (v) => (v == null || v === '' ? null : new Date(v).toISOString());
const untime = (v) => (v == null ? undefined : Date.parse(v));
const named = [['name', 'name'], ['names', 'names'], ['icon', 'icon'], ['color', 'color'], ['order', 'sort', 'num', 0]];
const KINDS = {
  book: { table: 'books', cols: named },
  account: { table: 'accounts', cols: [...named, ['type', 'type', null, 'cash'], ['note', 'note'], ['currency', 'currency', null, 'IDR'], ['initBalance', 'init_balance', 'num', 0], ['archived', 'archived', null, false]] },
  category: { table: 'categories', cols: [...named, ['type', 'type', null, 'expense']] },
  member: { table: 'members', cols: named },
  rate: { table: 'rates', cols: [['code', 'code'], ['rate', 'rate', 'num', 0]] },
  goal: { table: 'goals', cols: [['name', 'name'], ['target', 'target', 'num'], ['accountId', 'account_id'], ['due', 'due', 'time'], ['order', 'sort', 'num', 0]] },
  recurring: { table: 'recurring', cols: [['type', 'type'], ['amount', 'amount', 'num'], ['bookId', 'book_id'], ['accountId', 'account_id'], ['toAccountId', 'to_account_id'], ['categoryId', 'category_id'], ['memberId', 'member_id'], ['note', 'note'], ['freq', 'freq'], ['next', 'next_at', 'time'], ['day', 'day', 'num'], ['active', 'active', null, true]] },
  rule: { table: 'rules', cols: [['keyword', 'keyword'], ['categoryId', 'category_id'], ['order', 'sort', 'num', 0]] },
  budget: { table: 'budgets', cols: [['bookId', 'book_id'], ['categoryId', 'category_id'], ['amount', 'amount', 'num'], ['period', 'period', null, 'month'], ['start', 'start_at', 'time'], ['end', 'end_at', 'time']] },
  holding: { table: 'holdings', cols: [['type', 'type'], ['name', 'name'], ['symbol', 'symbol'],['units', 'units', 'num'], ['buyPrice', 'buy_price', 'num'], ['price', 'price', 'num'], ['priceAt', 'price_at', 'num'], ['order', 'sort', 'num', 0]] },
  debt: {
    table: 'debts', cols: [['dir', 'dir'], ['person', 'person'], ['amount', 'amount', 'num'], ['note', 'note'], ['due', 'due', 'time'], ['time', 'time', 'time']],
    children: [{ table: 'debt_payments', fk: 'debt_id', rows: (r) => (r.payments || []).map((p, idx) => ({ idx, amount: p.amount, time: time(p.time) })), fold: (rec, rows) => { rec.payments = rows.sort((a, b) => a.idx - b.idx).map((p) => ({ amount: Number(p.amount), time: untime(p.time) })); } }],
  },
  split: {
    table: 'splits', cols: [['title', 'title'], ['taxPct', 'tax_pct', 'num', 0], ['servicePct', 'service_pct', 'num', 0], ['time', 'time', 'time']],
    children: [
      { table: 'split_people', fk: 'split_id', rows: (r) => (r.people || []).map((name, idx) => ({ idx, name, paid: !!(r.paid || [])[idx] })), fold: (rec, rows) => { rows.sort((a, b) => a.idx - b.idx); rec.people = rows.map((p) => p.name); rec.paid = rows.map((p) => p.paid); } },
      { table: 'split_items', fk: 'split_id', rows: (r) => (r.items || []).map((it, idx) => ({ idx, name: it.name, price: it.price, who: it.who || [] })), fold: (rec, rows) => { rec.items = rows.sort((a, b) => a.idx - b.idx).map((it) => ({ name: it.name, price: Number(it.price), who: it.who || [] })); } },
    ],
  },
  bill: {
    table: 'bills', cols: [['type', 'type'], ['amount', 'amount', 'num', 0], ['time', 'time', 'time'], ['bookId', 'book_id'], ['accountId', 'account_id'], ['toAccountId', 'to_account_id'], ['categoryId', 'category_id'], ['memberId', 'member_id'], ['note', 'note'], ['hasPhoto', 'has_photo', null, false], ['goalId', 'goal_id'], ['recurringId', 'recurring_id'], ['createdAt', 'created_at', 'num']],
    children: [{ table: 'bill_tags', fk: 'bill_id', rows: (r) => [...new Set(r.tags || [])].map((tag) => ({ tag })), fold: (rec, rows) => { rec.tags = rows.map((x) => x.tag); } }],
  },
};
// Referenced rows go first so foreign keys hold within one push.
const ORDER = ['book', 'account', 'category', 'member', 'rate', 'goal', 'recurring', 'rule', 'budget', 'holding', 'debt', 'split', 'bill'];

function toRow(rec, spec, userId) {
  const row = { user_id: userId, id: rec.id, updated_at: Math.round(rec.updatedAt || 0), deleted: !!rec.deleted };
  for (const [f, c, conv, def] of spec.cols) {
    let v = rec[f];
    if (conv === 'time') v = time(v);
    else if (conv === 'num' && v != null && v !== '') v = Number(v);
    if (v == null || v === '' || Number.isNaN(v)) v = def ?? null;
    row[c] = v;
  }
  return row;
}
function fromRow(row, spec, kind) {
  const rec = { id: row.id, kind, updatedAt: Number(row.updated_at) || 0, deleted: !!row.deleted };
  for (const [f, c, conv] of spec.cols) {
    let v = row[c];
    if (v == null) continue;
    if (conv === 'time') v = untime(v);
    else if (conv === 'num') v = Number(v);
    rec[f] = v;
  }
  return rec;
}

// ---------- state ----------
function loadCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } }
let cfg = { session: null, owner: null, cursors: {}, lastSync: null, settingsAt: 0, settingsDirty: false, ...loadCfg() };
let status = { phase: cfg.session ? 'idle' : 'off', error: '', pending: store.dirtyIds().length };
let snap = { cfg, status };
const listeners = new Set();
const saveCfg = () => localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
const emit = () => { snap = { cfg, status }; listeners.forEach((l) => l()); };
const setStatus = (s) => { status = { ...status, pending: store.dirtyIds().length + (cfg.settingsDirty ? 1 : 0), ...s }; emit(); };

export function useSync() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snap);
}

async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const h = { apikey: SUPA_KEY, 'Content-Type': 'application/json', ...headers };
  if (auth && cfg.session?.access_token) h.Authorization = `Bearer ${cfg.session.access_token}`;
  const res = await fetch(SUPA_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.msg || data?.error_description || data?.message || data?.error || `HTTP ${res.status}`);
    err.status = res.status; err.code = data?.error_code || data?.code; throw err;
  }
  return data;
}

// ---------- auth ----------
function keepSession(d) {
  cfg.session = {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: Date.now() + (d.expires_in || 3600) * 1000,
    user: { id: d.user?.id, email: d.user?.email },
  };
  saveCfg();
}
// A different account (or the first sign-in) starts from a clean local copy.
function adoptOwner(userId) {
  if (cfg.owner === userId) return;
  store.resetAll();
  cfg = { ...cfg, owner: userId, cursors: {}, lastSync: null, settingsAt: 0, settingsDirty: false };
  saveCfg();
}
async function afterSignIn(d) {
  keepSession(d); adoptOwner(d.user.id); emit();
  await api('/rest/v1/rpc/seed_user', { method: 'POST', body: {} }).catch(() => {});
  await syncNow();
}

export async function signIn(email, password) {
  await afterSignIn(await api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }));
}
// Returns 'confirm' when the project requires e-mail confirmation before the first sign-in.
export async function signUp(email, password) {
  const d = await api('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
  if (!d?.access_token) return 'confirm';
  await afterSignIn(d);
  return 'ok';
}
export async function resetPassword(email) {
  await api('/auth/v1/recover', { method: 'POST', auth: false, body: { email } });
}
export async function signOut() {
  await api('/auth/v1/logout', { method: 'POST' }).catch(() => {});
  cfg = { session: null, owner: null, cursors: {}, lastSync: null, settingsAt: 0, settingsDirty: false };
  saveCfg(); store.resetAll();
  setStatus({ phase: 'off', error: '' });
}

// Refreshes the access token a minute before it expires.
export async function ensureToken() {
  if (!cfg.session) return false;
  if (Date.now() < cfg.session.expires_at - 60_000) return true;
  try {
    keepSession(await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: cfg.session.refresh_token } }));
    return true;
  } catch (e) {
    if (e.status === 400 || e.status === 401) { cfg.session = null; saveCfg(); setStatus({ phase: 'off', error: e.message }); }
    throw e;
  }
}
export const accessToken = () => cfg.session?.access_token || null;

// ---------- settings row ----------
const SYNCED_SETTINGS = ['lang', 'currency', 'theme', 'dark', 'bookId'];
const settingsKey = () => JSON.stringify(SYNCED_SETTINGS.map((k) => store.get().settings[k]));
let lastSettings = settingsKey();
let applyingRemote = false;
store.subscribe(() => {
  const now = settingsKey();
  if (now === lastSettings) return;
  lastSettings = now;
  if (applyingRemote || !cfg.session) return;
  cfg.settingsAt = Date.now(); cfg.settingsDirty = true; saveCfg(); scheduleSync();
});

// ---------- sync ----------
let running = null; let again = false;
export function syncNow() {
  if (running) { again = true; return running; }
  running = doSync().finally(() => { running = null; if (again) { again = false; syncNow(); } });
  return running;
}

async function pullTable(table) {
  const rows = [];
  let cursor = cfg.cursors[table] || null;
  for (;;) {
    const page = await api(`/rest/v1/${table}?select=*&order=server_ts.asc&limit=${PAGE}${cursor ? `&server_ts=gt.${encodeURIComponent(cursor)}` : ''}`);
    rows.push(...page);
    if (page.length) cursor = page[page.length - 1].server_ts;
    if (page.length < PAGE) break;
  }
  return { rows, cursor };
}

async function pull() {
  const next = {};
  const incoming = [];
  for (const kind of ORDER) {
    const spec = KINDS[kind];
    const { rows, cursor } = await pullTable(spec.table);
    next[spec.table] = cursor;
    const recs = new Map(rows.map((r) => [r.id, fromRow(r, spec, kind)]));
    for (const ch of spec.children || []) {
      const { rows: crow, cursor: ccur } = await pullTable(ch.table);
      next[ch.table] = ccur;
      // Children are rewritten with their parent's updated_at; only that set belongs to the parent now.
      const groups = new Map();
      for (const c of crow) { const k = c[ch.fk]; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
      for (const [pid, list] of groups) {
        let rec = recs.get(pid);
        if (!rec) { const cur = store.get().records[pid]; if (!cur) continue; rec = { ...cur }; recs.set(pid, rec); }
        ch.fold(rec, list.filter((c) => Number(c.updated_at) === Math.round(rec.updatedAt)));
      }
      for (const r of rows) if (!groups.has(r.id)) ch.fold(recs.get(r.id), []);
    }
    incoming.push(...recs.values());
  }
  // A child-only change arrives with the parent's own updatedAt; nudge it so merge accepts it.
  store.merge(incoming.map((r) => {
    const cur = store.get().records[r.id];
    return cur && Math.round(cur.updatedAt) === r.updatedAt && !store.dirtyIds().includes(r.id) ? { ...r, updatedAt: cur.updatedAt + 0.001 } : r;
  }));

  const s = (await api('/rest/v1/user_settings?select=*'))?.[0];
  if (s && Number(s.updated_at) > cfg.settingsAt && !cfg.settingsDirty) {
    applyingRemote = true;
    store.setSettings({ lang: s.lang, currency: s.currency, dark: s.dark, ...(s.accent ? { theme: s.accent } : {}), ...(s.book_id ? { bookId: s.book_id } : {}) });
    applyingRemote = false;
    lastSettings = settingsKey();
    cfg.settingsAt = Number(s.updated_at);
  }
  cfg.cursors = { ...cfg.cursors, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v)) };
}

async function push() {
  const userId = cfg.session.user.id;
  if (cfg.settingsDirty) {
    const st = store.get().settings;
    await api('/rest/v1/user_settings?on_conflict=user_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: [{ user_id: userId, lang: st.lang, currency: st.currency, accent: st.theme, dark: !!st.dark, book_id: st.bookId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta', updated_at: cfg.settingsAt }],
    });
    cfg.settingsDirty = false; saveCfg();
  }
  const recs = store.get().records;
  const ids = store.dirtyIds().filter((id) => recs[id] && KINDS[recs[id].kind]);
  const sent = new Map();
  for (const kind of ORDER) {
    const spec = KINDS[kind];
    const list = ids.map((id) => recs[id]).filter((r) => r.kind === kind);
    for (let i = 0; i < list.length; i += 200) {
      const chunk = list.slice(i, i + 200);
      await api(`/rest/v1/${spec.table}?on_conflict=user_id,id`, {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: chunk.map((r) => toRow(r, spec, userId)),
      });
      for (const ch of spec.children || []) {
        for (let j = 0; j < chunk.length; j += 100) {
          const part = chunk.slice(j, j + 100);
          await api(`/rest/v1/${ch.table}?${ch.fk}=in.(${part.map((r) => `"${r.id.replace(/"/g, '')}"`).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
          const rows = part.flatMap((r) => ch.rows(r).map((c) => ({ user_id: userId, [ch.fk]: r.id, updated_at: Math.round(r.updatedAt || 0), ...c })));
          if (rows.length) await api(`/rest/v1/${ch.table}`, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: rows });
        }
      }
      chunk.forEach((r) => sent.set(r.id, r.updatedAt));
    }
  }
  // A record edited again while its push was in flight stays queued.
  store.clearDirty([...sent].filter(([id, at]) => store.get().records[id]?.updatedAt === at).map(([id]) => id));
}

let timer = null; let retryTimer = null; let retryDelay = 2000;
function scheduleSync(ms = 1200) { setStatus({}); clearTimeout(timer); timer = setTimeout(syncNow, ms); }

async function doSync() {
  if (!configured || !cfg.session) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus({ phase: 'offline' }); return; }
  setStatus({ phase: 'syncing', error: '' });
  try {
    await ensureToken();
    await push();
    await pull();
    cfg.lastSync = Date.now(); saveCfg();
    setStatus({ phase: 'idle', error: '' });
    retryDelay = 2000;
  } catch (e) {
    if (e.status === 401) { cfg.session = null; saveCfg(); setStatus({ phase: 'off', error: e.message }); return; }
    setStatus({ phase: navigator.onLine === false ? 'offline' : 'error', error: e.message });
    clearTimeout(retryTimer); retryTimer = setTimeout(syncNow, retryDelay); retryDelay = Math.min(retryDelay * 2, 60_000);
  }
}

// Background triggers: after edits, on focus, when back online and every 30 s.
export function startAutoSync() {
  store.onLocalChange(() => scheduleSync());
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => cfg.session && setStatus({ phase: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  setInterval(() => { if (!document.hidden) syncNow(); }, 30_000);
  if (cfg.session) syncNow();
}

// ---------- backup files ----------
export function backupBlob() {
  const s = store.get();
  return new Blob([JSON.stringify({ app: 'kasku-plus', version: 2, exportedAt: Date.now(), records: Object.values(s.records) }, null, 1)], { type: 'application/json' });
}
export async function restoreBackup(file) {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'kasku-plus' || !Array.isArray(data.records)) throw new Error('bad');
  store.merge(data.records.map((r) => ({ ...r, updatedAt: Math.max(r.updatedAt || 0, 1) })), { markDirty: true });
  syncNow();
}

export const _test = { toRow, fromRow, KINDS, ORDER };
