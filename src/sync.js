// Cloud sync through a Supabase project (plain REST, no SDK).
// Each device keeps a full local copy; changes are pushed as records and
// pulled by the server timestamp, merged newest-wins per record.
import { useSyncExternalStore } from 'react';
import { store } from './store.js';

const CFG_KEY = 'kasku.v1.sync';
const TABLE = 'kasku_records';

export const SETUP_SQL = `create table if not exists ${TABLE} (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  kind text not null,
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_ts timestamptz not null default now(),
  primary key (user_id, id)
);
alter table ${TABLE} enable row level security;
create policy "own rows" on ${TABLE} for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function kasku_touch() returns trigger
  language plpgsql as $$ begin new.server_ts = clock_timestamp(); return new; end $$;
create trigger kasku_touch before insert or update on ${TABLE}
  for each row execute function kasku_touch();
create index if not exists kasku_records_ts on ${TABLE} (user_id, server_ts);`;

function loadCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; }
}
let cfg = { url: '', key: '', session: null, lastPull: null, lastSync: null, auto: true, ...loadCfg() };
let status = { phase: cfg.session ? 'idle' : 'off', error: '' };
let snap = { cfg, status };
const listeners = new Set();

function save() { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
function emit() { snap = { cfg, status }; listeners.forEach((l) => l()); }
function setStatus(s) { status = { ...status, ...s }; emit(); }

export function useSync() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snap);
}

const base = () => cfg.url.replace(/\/+$/, '');

async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const h = { apikey: cfg.key, 'Content-Type': 'application/json', ...headers };
  if (auth && cfg.session?.access_token) h.Authorization = `Bearer ${cfg.session.access_token}`;
  const res = await fetch(base() + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.msg || data?.error_description || data?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return data;
}

function keepSession(d) {
  cfg.session = {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: Date.now() + (d.expires_in || 3600) * 1000,
    user: { id: d.user?.id, email: d.user?.email },
  };
  save();
}

export function configure(url, key) {
  cfg.url = url.trim(); cfg.key = key.trim(); save(); emit();
}

export async function signIn(email, password, create = false) {
  if (!cfg.url || !cfg.key) throw new Error('URL / key?');
  setStatus({ phase: 'syncing', error: '' });
  try {
    if (create) {
      const d = await api('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
      if (!d?.access_token) {
        setStatus({ phase: 'off', error: '' });
        return 'confirm';
      }
      keepSession(d);
    } else {
      const d = await api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
      keepSession(d);
    }
    cfg.lastPull = null; save();
    // First sign-in on this device: send everything we have.
    await syncNow({ pushAll: true });
    return 'ok';
  } catch (e) {
    setStatus({ phase: cfg.session ? 'error' : 'off', error: e.message });
    throw e;
  }
}

export function signOut() {
  cfg.session = null; cfg.lastPull = null; save();
  setStatus({ phase: 'off', error: '' });
}

async function ensureToken() {
  if (!cfg.session) return false;
  if (Date.now() < cfg.session.expires_at - 60_000) return true;
  const d = await api('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', auth: false, body: { refresh_token: cfg.session.refresh_token },
  });
  keepSession(d);
  return true;
}

let running = null;
let again = false;

export function syncNow(opts = {}) {
  if (running) { again = true; return running; }
  running = doSync(opts).finally(() => {
    running = null;
    if (again) { again = false; syncNow(); }
  });
  return running;
}

async function doSync({ pushAll = false } = {}) {
  if (!cfg.session || !cfg.url) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus({ phase: 'offline' }); return; }
  setStatus({ phase: 'syncing', error: '' });
  try {
    await ensureToken();
    const uidv = cfg.session.user.id;

    // 1) pull what changed on other devices
    let q = `/rest/v1/${TABLE}?select=id,kind,data,updated_at,deleted,server_ts&order=server_ts.asc&limit=1000`;
    let lastPull = cfg.lastPull;
    for (;;) {
      const url = lastPull ? `${q}&server_ts=gt.${encodeURIComponent(lastPull)}` : q;
      const rows = await api(url);
      if (!rows?.length) break;
      store.merge(rows.map((r) => ({ ...r.data, id: r.id, kind: r.kind, updatedAt: Number(r.updated_at), deleted: r.deleted })));
      lastPull = rows[rows.length - 1].server_ts;
      if (rows.length < 1000) break;
    }

    // 2) push local changes
    const recs = store.get().records;
    const ids = pushAll ? Object.keys(recs).filter((i) => recs[i].updatedAt > 0) : store.dirtyIds();
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500).map((id) => recs[id]).filter(Boolean);
      if (!chunk.length) continue;
      await api(`/rest/v1/${TABLE}?on_conflict=user_id,id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: chunk.map((r) => ({
          user_id: uidv, id: r.id, kind: r.kind, data: r, updated_at: r.updatedAt || 0, deleted: !!r.deleted,
        })),
      });
    }
    store.clearDirty(ids);

    cfg.lastPull = lastPull; cfg.lastSync = Date.now(); save();
    setStatus({ phase: 'idle', error: '' });
  } catch (e) {
    if (e.status === 401) { cfg.session = null; save(); setStatus({ phase: 'off', error: e.message }); return; }
    setStatus({ phase: 'error', error: e.message });
  }
}

// Background triggers: after edits, on focus, when back online and every 20 s.
let timer = null;
export function startAutoSync() {
  store.onLocalChange(() => {
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(), 1200);
  });
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => cfg.session && setStatus({ phase: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  setInterval(() => { if (!document.hidden) syncNow(); }, 20_000);
  if (cfg.session) syncNow();
}

// ---------- backup files ----------
export function backupBlob() {
  const s = store.get();
  return new Blob([JSON.stringify({ app: 'kasku-plus', version: 1, exportedAt: Date.now(), records: Object.values(s.records) }, null, 1)], { type: 'application/json' });
}

export async function restoreBackup(file) {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'kasku-plus' || !Array.isArray(data.records)) throw new Error('bad');
  store.merge(data.records, { markDirty: true });
  syncNow();
}
