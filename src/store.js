// Local-first data store. Every record carries an id, a kind, updatedAt and a
// deleted flag so two devices can merge their copies record by record.
import { useSyncExternalStore } from 'react';
import { DEFAULT_ICONS, ICON_MAP } from './icons.js';

const REC_KEY = 'kasku.v1.records';
const SET_KEY = 'kasku.v1.settings';
const DIRTY_KEY = 'kasku.v1.dirty';

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

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
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

function persist() {
  localStorage.setItem(REC_KEY, JSON.stringify(state.records));
  localStorage.setItem(SET_KEY, JSON.stringify(state.settings));
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
}
function emit() { listeners.forEach((l) => l()); }

export const store = {
  get: () => state,
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  onLocalChange(fn) { changeHooks.add(fn); return () => changeHooks.delete(fn); },
  dirtyIds: () => [...dirty],
  clearDirty(ids) { ids.forEach((i) => dirty.delete(i)); persist(); },

  put(rec) {
    const next = { ...state.records[rec.id], ...rec, updatedAt: Date.now() };
    state = { ...state, records: { ...state.records, [rec.id]: next } };
    dirty.add(rec.id);
    persist(); emit(); changeHooks.forEach((f) => f());
    return next;
  },
  remove(id) { if (state.records[id]) store.put({ id, deleted: true }); },
  setSettings(patch) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    persist(); emit();
  },
  // Merge records coming from the cloud or a backup: newest updatedAt wins.
  merge(incoming, { markDirty = false } = {}) {
    const recs = { ...state.records };
    let changed = false;
    for (const r of incoming) {
      const cur = recs[r.id];
      if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) {
        recs[r.id] = r; changed = true;
        if (markDirty) dirty.add(r.id); else dirty.delete(r.id);
      }
    }
    if (changed) { state = { ...state, records: recs }; persist(); emit(); }
    return changed;
  },
  // Several records in one notification (imports, clean-ups).
  putMany(recs) {
    const next = { ...state.records }; const now = Date.now();
    for (const rec of recs) { next[rec.id] = { ...next[rec.id], ...rec, updatedAt: now }; dirty.add(rec.id); }
    state = { ...state, records: next };
    persist(); emit(); changeHooks.forEach((f) => f());
  },
  resetAll() {
    state = { records: defaultRecords(), settings: { ...defaultSettings, lang: state.settings.lang } };
    dirty = new Set(); persist(); emit();
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
  // Balances stay in each account's own currency; a transfer between currencies converts at the saved rates.
  const base = state.settings.currency;
  const rate = (accId) => {
    const c = records[accId]?.currency; const r = records[`rate-${c}`];
    return !c || c === base || !r || r.deleted || !(r.rate > 0) ? 1 : Number(r.rate);
  };
  for (const a of live(records, 'account')) bal[a.id] = Number(a.initBalance) || 0;
  for (const b of live(records, 'bill')) {
    const amt = Number(b.amount) || 0;
    if (b.type === 'expense') bal[b.accountId] = (bal[b.accountId] || 0) - amt;
    else if (b.type === 'income') bal[b.accountId] = (bal[b.accountId] || 0) + amt;
    else if (b.type === 'transfer') {
      bal[b.accountId] = (bal[b.accountId] || 0) - amt;
      bal[b.toAccountId] = (bal[b.toAccountId] || 0) + amt * rate(b.accountId) / rate(b.toAccountId);
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
