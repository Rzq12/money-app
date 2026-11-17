// Local-first data store. Every record carries an id, a kind, updatedAt and a
// deleted flag so two devices can merge their copies record by record.
import { useSyncExternalStore } from 'react';
import { DEFAULT_ICONS, ICON_MAP } from './icons.js';

const REC_KEY = 'kasku.v1.records';
const SET_KEY = 'kasku.v1.settings';
const DIRTY_KEY = 'kasku.v1.dirty';
export const CHAT_KEY = 'kasku.v1.chat';

// Icons are keys into the drawn set in icons.js (bolt 001); DEFAULT_ICONS holds the built-in choices.
const CI = DEFAULT_ICONS.categories; const WI = DEFAULT_ICONS.walletTypes; const MI = DEFAULT_ICONS.members;
const cat = (id, type, color, idName, enName, order) => ({
  id, kind: 'category', type, icon: CI[id], color, names: { id: idName, en: enName }, order, updatedAt: 0,
});

// Fixed ids so fresh installs on two devices share the same starter data.
export function defaultRecords() {
  const r = [
    { id: 'book-default', kind: 'book', names: { id: 'Buku harian', en: 'Daily ledger' }, icon: DEFAULT_ICONS.ledger, order: 0, updatedAt: 0 },
    { id: 'acc-cash', kind: 'account', type: 'cash', names: { id: 'Tunai', en: 'Cash' }, icon: WI.cash, color: '#29bc9b', currency: 'IDR', initBalance: 0, order: 0, updatedAt: 0 },
    { id: 'acc-bank', kind: 'account', type: 'debit', names: { id: 'Kartu debit', en: 'Debit card' }, icon: WI.debit, color: '#0070f3', currency: 'IDR', initBalance: 0, order: 1, updatedAt: 0 },
    { id: 'acc-ewallet', kind: 'account', type: 'ewallet', names: { id: 'Dompet digital', en: 'E-wallet' }, icon: WI.ewallet, color: '#7928ca', currency: 'IDR', initBalance: 0, order: 2, updatedAt: 0 },
    { id: 'mem-me', kind: 'member', names: { id: 'Diri sendiri', en: 'Myself' }, icon: MI['mem-me'], order: 0, updatedAt: 0 },
    { id: 'mem-partner', kind: 'member', names: { id: 'Pasangan', en: 'Partner' }, icon: MI['mem-partner'], order: 1, updatedAt: 0 },
    { id: 'mem-child', kind: 'member', names: { id: 'Anak', en: 'Child' }, icon: MI['mem-child'], order: 2, updatedAt: 0 },
    { id: 'mem-parent', kind: 'member', names: { id: 'Orang tua', en: 'Parent' }, icon: MI['mem-parent'], order: 3, updatedAt: 0 },
    cat('cat-food', 'expense', '#f5a623', 'Makan', 'Food', 0),
    cat('cat-daily', 'expense', '#00dfd8', 'Harian', 'Daily', 1),
    cat('cat-traffic', 'expense', '#29bc9b', 'Transportasi', 'Transport', 2),
    cat('cat-social', 'expense', '#7928ca', 'Sosial', 'Social', 3),
    cat('cat-home', 'expense', '#ab570a', 'Rumah', 'Housing', 4),
    cat('cat-gift', 'expense', '#ff0080', 'Hadiah', 'Gift', 5),
    cat('cat-phone', 'expense', '#0070f3', 'Komunikasi', 'Phone', 6),
    cat('cat-dress', 'expense', '#ff4d4d', 'Pakaian', 'Clothes', 7),
    cat('cat-fun', 'expense', '#eb367f', 'Rekreasi', 'Fun', 8),
    cat('cat-beauty', 'expense', '#4c2889', 'Kecantikan', 'Beauty', 9),
    cat('cat-medical', 'expense', '#c50000', 'Medis', 'Medical', 10),
    cat('cat-tax', 'expense', '#a1a1a1', 'Pajak', 'Tax', 11),
    cat('cat-edu', 'expense', '#50e3c2', 'Pendidikan', 'Education', 12),
    cat('cat-baby', 'expense', '#f9cb28', 'Bayi', 'Baby', 13),
    cat('cat-pet', 'expense', '#888888', 'Peliharaan', 'Pet', 14),
    cat('cat-travel', 'expense', '#0761d1', 'Bepergian', 'Travel', 15),
    cat('cat-wage', 'income', '#f5a623', 'Gaji', 'Salary', 0),
    cat('cat-bonus', 'income', '#7928ca', 'Bonus', 'Bonus', 1),
    cat('cat-invest', 'income', '#29bc9b', 'Investasi', 'Investment', 2),
    cat('cat-parttime', 'income', '#0070f3', 'Kerja sampingan', 'Side job', 3),
    cat('cat-other-in', 'income', '#888888', 'Lainnya', 'Other', 4),
  ];
  return Object.fromEntries(r.map((x) => [x.id, x]));
}

// Built-in records saved by an earlier version still carry an emoji icon; give them back their
// drawn icon. Records the user made are left alone and render the fallback icon.
function restoreBuiltInIcons(records) {
  const defs = defaultRecords();
  let out = records;
  for (const id of Object.keys(defs)) {
    const r = records[id];
    if (r && !ICON_MAP[r.icon]) { if (out === records) out = { ...records }; out[id] = { ...r, icon: defs[id].icon }; }
  }
  return out;
}

// Accent choices for the one accented control (the Catat button, today's marker, the logo's plus).
// Kasku's own pink comes first; everything else in the interface stays ink.
export const ACCENTS = ['#f06292', '#0070f3', '#7928ca', '#ff4d4d', '#f5a623', '#29bc9b', '#171717'];

const defaultSettings = {
  lang: 'id', theme: ACCENTS[0], themeV: 2, dark: false, currency: 'IDR', bookId: 'book-default',
  lastAccountId: 'acc-cash',
};

// Keys whose saved copy could not be read at start-up. The unreadable text is kept under
// "<key>.unreadable-<time>" so it is never overwritten by the next save.
export const loadErrors = [];
function load(key, fallback) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  if (raw == null) return fallback;
  try { return JSON.parse(raw) ?? fallback; } catch {
    try { localStorage.setItem(`${key}.unreadable-${Date.now()}`, raw); } catch { /* storage full: the copy below still stays untouched until the user saves */ }
    loadErrors.push(key);
    return fallback;
  }
}

let state = {
  records: restoreBuiltInIcons({ ...defaultRecords(), ...load(REC_KEY, {}) }),
  settings: { ...defaultSettings, themeV: 1, ...load(SET_KEY, {}) },
};
// Themes saved before the accent became its own setting reset to the default accent once.
if (state.settings.themeV !== 2 || !ACCENTS.includes(state.settings.theme)) state.settings = { ...state.settings, theme: ACCENTS[0], themeV: 2 };
let dirty = new Set(load(DIRTY_KEY, []));
const listeners = new Set();
const changeHooks = new Set();
const errorHooks = new Set();

function write(s, d) {
  localStorage.setItem(REC_KEY, JSON.stringify(s.records));
  localStorage.setItem(SET_KEY, JSON.stringify(s.settings));
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...d]));
}
// A change reaches the screen only after it is on disk. When the device storage is full the old
// copy stays both on disk and in memory, and the error hooks tell the user nothing was saved.
function commit(nextState, nextDirty) {
  try { write(nextState, nextDirty); } catch (e) {
    try { write(state, dirty); } catch { /* the keys that failed still hold the old copy */ }
    errorHooks.forEach((f) => f(e));
    return false;
  }
  state = nextState; dirty = nextDirty;
  return true;
}
function emit() { listeners.forEach((l) => l()); }

export const store = {
  get: () => state,
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  onLocalChange(fn) { changeHooks.add(fn); return () => changeHooks.delete(fn); },
  onError(fn) { errorHooks.add(fn); return () => errorHooks.delete(fn); },
  dirtyIds: () => [...dirty],
  clearDirty(ids) { const d = new Set(dirty); ids.forEach((i) => d.delete(i)); commit(state, d); },

  // Returns the saved record, or null when it could not be written. `at` sets updatedAt instead of
  // now, for writes that must not win over a newer edit made on another device.
  put(rec, { at } = {}) {
    const next = { ...state.records[rec.id], ...rec, updatedAt: at ?? Date.now() };
    const d = new Set(dirty); d.add(rec.id);
    if (!commit({ ...state, records: { ...state.records, [rec.id]: next } }, d)) return null;
    emit(); changeHooks.forEach((f) => f());
    return next;
  },
  remove(id) { return state.records[id] ? store.put({ id, deleted: true }) : null; },
  setSettings(patch) {
    if (!commit({ ...state, settings: { ...state.settings, ...patch } }, dirty)) return false;
    emit(); return true;
  },
  // Merge records coming from the cloud or a backup: newest updatedAt wins.
  merge(incoming, { markDirty = false } = {}) {
    const recs = { ...state.records }; const d = new Set(dirty);
    let changed = false;
    for (const r of incoming) {
      const cur = recs[r.id];
      if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) {
        recs[r.id] = r; changed = true;
        if (markDirty) d.add(r.id); else d.delete(r.id);
      }
    }
    if (!changed || !commit({ ...state, records: recs }, d)) return false;
    emit(); return true;
  },
  // Several records in one notification (imports, clean-ups, price updates). keepTime leaves each
  // record's updatedAt as it was, so a background refresh never wins over an edit from another device.
  putMany(recs, { keepTime = false } = {}) {
    const next = { ...state.records }; const now = Date.now(); const d = new Set(dirty);
    for (const rec of recs) { const old = next[rec.id]; next[rec.id] = { ...old, ...rec, updatedAt: keepTime && old ? old.updatedAt || 0 : now }; d.add(rec.id); }
    if (!commit({ ...state, records: next }, d)) return false;
    emit(); changeHooks.forEach((f) => f());
    return true;
  },
  // Also forgets this device's chat history, which may belong to the account being signed out.
  resetAll() {
    try { localStorage.removeItem(CHAT_KEY); } catch { /* nothing to forget */ }
    commit({ records: defaultRecords(), settings: { ...defaultSettings, lang: state.settings.lang } }, new Set());
    emit();
  },
};

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get);
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

// ---------- derived helpers ----------
export const live = (records, kind) =>
  Object.values(records).filter((r) => r.kind === kind && !r.deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const nameOf = (r, lang) => (r ? r.name || r.names?.[lang] || r.names?.id || '—' : '—');

export function accountBalances(records) {
  const bal = {};
  // Balances stay in each account's own currency; a transfer between currencies converts at the saved
  // rates. Without a rate for both sides the receiving account is not credited (the app asks for the
  // rate before saving such a transfer), so an amount is never taken 1:1 across currencies.
  const base = state.settings.currency;
  const cur = (accId) => records[accId]?.currency || base;
  const rate = (accId) => {
    const c = cur(accId); if (c === base) return 1;
    const r = records[`rate-${c}`];
    return r && !r.deleted && r.rate > 0 ? Number(r.rate) : null;
  };
  for (const a of live(records, 'account')) bal[a.id] = Number(a.initBalance) || 0;
  for (const b of live(records, 'bill')) {
    const amt = Number(b.amount) || 0;
    if (b.type === 'expense') bal[b.accountId] = (bal[b.accountId] || 0) - amt;
    else if (b.type === 'income') bal[b.accountId] = (bal[b.accountId] || 0) + amt;
    else if (b.type === 'transfer') {
      bal[b.accountId] = (bal[b.accountId] || 0) - amt;
      if (!b.toAccountId) continue;
      const from = rate(b.accountId); const to = rate(b.toAccountId);
      const into = cur(b.accountId) === cur(b.toAccountId) ? amt : from && to ? amt * from / to : null;
      if (into != null) bal[b.toAccountId] = (bal[b.toAccountId] || 0) + into;
    }
  }
  return bal;
}

export const LIABILITY = new Set(['credit', 'payable']);

// Matches TodayWidgetProvider.a (MECHANICS.md): currency format with 0 to 2 decimals, "$%.2f" as fallback.
// opts.whole drops decimals, as TodayWidgetMediumProvider.c does for the weekly totals.
export function formatMoney(n, currency = 'IDR', lang = 'id', opts = {}) {
  const v = Number(n) || 0;
  const max = opts.whole || opts.compact ? 0 : 2;
  try {
    return new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: max,
      ...(opts.compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    }).format(v);
  } catch { return v === 0 ? '$0' : `$${v.toFixed(2)}`; }
}

// First day of the week from the locale, like Calendar.getFirstDayOfWeek() in
// TodayWidgetMediumProvider.d(long). Returns 0 = Sunday … 6 = Saturday.
export function firstDayOfWeek(lang) {
  try {
    const loc = new Intl.Locale(lang === 'id' ? 'id-ID' : (navigator.language || 'en-US'));
    const fd = (loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo)?.firstDay;
    if (fd) return fd % 7;
  } catch { /* fall through */ }
  return 0; // id-ID and en-US both start on Sunday
}

export const CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP', 'AUD', 'CNY', 'KRW', 'THB', 'VND', 'PHP', 'INR', 'SAR'];
