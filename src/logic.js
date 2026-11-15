// Helpers behind the feature pages: currency conversion, quick-entry parsing, recurring bills,
// budgets, goals, split bills, calculators, import parsing, duplicate detection and receipt photos.
import { unzipSync, strFromU8 } from 'fflate';
import { store, live, nameOf, firstDayOfWeek } from './store.js';

const DAY = 86400000;
export const dayKeyOf = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const toDateInput = (ms) => dayKeyOf(ms);
export const fromDateInput = (s, h = 12) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };

// ---------- currency: rates are "1 unit of CODE = rate units of the base currency" ----------
export function rateOf(records, code, base) {
  if (!code || code === base) return 1;
  const r = records[`rate-${code}`];
  return r && !r.deleted && r.rate > 0 ? Number(r.rate) : 1;
}
export const hasRate = (records, code, base) => rateOf(records, code, base) !== 1 || code === base;
export const billBase = (b, records, base) => (Number(b.amount) || 0) * rateOf(records, records[b.accountId]?.currency, base);

// ---------- periods and budgets ----------
export function rangeOf(period, now, lang, b) {
  const d = new Date(now); const y = d.getFullYear(); const m = d.getMonth();
  if (period === 'custom' && b?.start && b?.end) return [b.start, b.end + DAY];
  if (period === 'year') return [new Date(y, 0, 1).getTime(), new Date(y + 1, 0, 1).getTime()];
  if (period === 'week') {
    const s = new Date(y, m, d.getDate() - ((d.getDay() - firstDayOfWeek(lang) + 7) % 7));
    return [s.getTime(), new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7).getTime()];
  }
  return [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()];
}
export function budgetSpent(b, records, settings, now = Date.now()) {
  const [start, end] = rangeOf(b.period || 'month', now, settings.lang, b);
  let spent = 0;
  for (const x of live(records, 'bill')) {
    if (x.type !== 'expense' || (x.bookId || 'book-default') !== b.bookId || x.time < start || x.time >= end) continue;
    if (b.categoryId && x.categoryId !== b.categoryId) continue;
    spent += billBase(x, records, settings.currency);
  }
  return { spent, start, end };
}
// The overall monthly budget (no category) is the one the ledger header shows.
export const mainBudget = (records, bookId) =>
  live(records, 'budget').find((b) => b.bookId === bookId && !b.categoryId && (b.period || 'month') === 'month');

// ---------- goals: deposits are real transfers that carry the goal's id ----------
export function goalSaved(goal, records, base) {
  let sum = 0;
  for (const b of live(records, 'bill')) {
    if (b.goalId !== goal.id || b.type !== 'transfer') continue;
    const amt = Number(b.amount) || 0;
    if (b.toAccountId === goal.accountId) sum += amt * rateOf(records, records[b.accountId]?.currency, base) / rateOf(records, records[goal.accountId]?.currency, base);
    else if (b.accountId === goal.accountId) sum -= amt;
  }
  return sum;
}

// ---------- rules and quick entry (chat, voice) ----------
export function matchRule(text, records, type) {
  const low = (text || '').toLowerCase();
  let best = null;
  for (const r of live(records, 'rule')) {
    const c = records[r.categoryId];
    if (!r.keyword || !c || c.deleted || (type && c.type !== type)) continue;
    if (low.includes(r.keyword.toLowerCase()) && (!best || r.keyword.length > best.keyword.length)) best = r;
  }
  return best ? records[best.categoryId] : null;
}
export function parseNumber(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/rp\.?|idr|\s/gi, '');
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()+-]/g, '');
  let n;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) n = parseFloat(s.replace(/,/g, ''));
  else n = parseFloat(s.replace(',', '.'));
  return neg ? -n : n;
}
const UNIT = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6, m: 1e9, miliar: 1e9 };
export function parseAmount(text) {
  const m = (text || '').match(/(?:rp\.?\s*)?(\d[\d.,]*\d|\d)\s*(ribu|rb|k|juta|jt|miliar|m)?(?![a-z0-9])/i);
  if (!m) return null;
  const unit = (m[2] || '').toLowerCase();
  const n = unit ? parseFloat(m[1].replace(',', '.')) * UNIT[unit] : parseNumber(m[1]);
  return n > 0 ? { value: Math.round(n * 100) / 100, match: m[0] } : null;
}
const INCOME_WORDS = /\b(masuk|gaji|gajian|terima|diterima|menerima|pemasukan|bonus|dapat|income|salary|received|credited)\b/i;
export function fallbackCat(records, type) {
  const pref = records[type === 'income' ? 'cat-other-in' : 'cat-daily'];
  if (pref && !pref.deleted) return pref;
  return live(records, 'category').find((c) => c.type === type) || null;
}
export function catByName(text, records, type) {
  const low = (text || '').toLowerCase();
  if (!low) return null;
  return live(records, 'category').find((c) => (!type || c.type === type)
    && [c.name, c.names?.id, c.names?.en].some((n) => n && new RegExp(`(^|[^a-z])${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(low))) || null;
}
// "makan siang 25rb" → { type, amount, note, category, how }. Returns null when no amount is found.
export function parseQuick(text, records) {
  const a = parseAmount(text);
  if (!a) return null;
  const rule = matchRule(text, records);
  const type = rule ? rule.type : INCOME_WORDS.test(text) ? 'income' : 'expense';
  const byName = rule ? null : catByName(text, records, type);
  const category = rule || byName || fallbackCat(records, type);
  const note = text.replace(a.match, ' ').replace(/\s+/g, ' ').trim();
  return { type, amount: a.value, note, category, how: rule ? 'rule' : byName ? 'name' : 'fallback' };
}

// ---------- recurring bills ----------
export function nextDate(ms, freq, anchorDay) {
  const d = new Date(ms);
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else {
    const day = anchorDay || d.getDate();
    const last = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
    return new Date(d.getFullYear(), d.getMonth() + 1, Math.min(day, last), d.getHours(), d.getMinutes()).getTime();
  }
  return d.getTime();
}
// Creates every bill that is due. Ids are derived from the schedule and the date, so two devices
// that both run this produce the same record instead of a duplicate.
export function runRecurring(now = Date.now()) {
  let made = 0;
  for (const r of live(store.get().records, 'recurring')) {
    if (!r.active || !r.next) continue;
    let next = r.next; let guard = 0;
    while (next <= now && guard++ < 400) {
      const id = `${r.id}@${dayKeyOf(next)}`;
      if (!store.get().records[id]) {
        store.put({
          id, kind: 'bill', type: r.type, amount: r.amount, note: r.note || '', time: next, bookId: r.bookId, accountId: r.accountId,
          toAccountId: r.type === 'transfer' ? r.toAccountId : null, categoryId: r.type === 'transfer' ? null : r.categoryId,
          memberId: r.memberId || 'mem-me', recurringId: r.id, createdAt: now,
        });
        made++;
      }
      next = nextDate(next, r.freq, r.day);
    }
    if (next !== r.next) store.put({ id: r.id, next });
  }
  return made;
}

// ---------- split bill ----------
export function splitTotals(s) {
  const n = s.people.length;
  const per = Array(n).fill(0);
  let subtotal = 0;
  for (const it of s.items) {
    const price = Number(it.price) || 0;
    const who = it.who?.length ? it.who.filter((i) => i < n) : s.people.map((_, i) => i);
    if (!who.length) continue;
    subtotal += price;
    for (const i of who) per[i] += price / who.length;
  }
  const service = subtotal * (Number(s.servicePct) || 0) / 100;
  const tax = (subtotal + service) * (Number(s.taxPct) || 0) / 100;
  const extra = service + tax;
  return { subtotal, service, tax, total: subtotal + extra, per: per.map((v) => (subtotal ? v + extra * (v / subtotal) : 0)) };
}

// ---------- calculators ----------
export function kpr({ price, dpPct, ratePct, years }) {
  const loan = Math.max(0, price * (1 - dpPct / 100));
  const n = Math.max(1, Math.round(years * 12));
  const i = ratePct / 1200;
  const pay = i > 0 ? loan * i / (1 - (1 + i) ** -n) : loan / n;
  const rows = []; let bal = loan;
  for (let k = 1; k <= Math.min(n, 12); k++) { const int = bal * i; const prin = pay - int; bal -= prin; rows.push({ k, int, prin, bal: Math.max(0, bal) }); }
  return { loan, dp: price - loan, n, pay, total: pay * n, interest: pay * n - loan, rows };
}
// Annual PPh 21 for a permanent employee: Pasal 17 rates (UU HPP), biaya jabatan 5% capped at
// Rp 6 juta a year, PTKP Rp 54 juta + Rp 4,5 juta if married + Rp 4,5 juta per dependant (max 3).
const BRACKETS = [[60e6, 0.05], [250e6, 0.15], [500e6, 0.25], [5e9, 0.3], [Infinity, 0.35]];
export function pph21({ gross, bonus = 0, pension = 0, married = false, deps = 0 }) {
  const annual = gross * 12 + bonus;
  const jabatan = Math.min(annual * 0.05, 6e6);
  const iuran = pension * 12;
  const neto = annual - jabatan - iuran;
  const ptkp = 54e6 + (married ? 4.5e6 : 0) + Math.min(3, Math.max(0, deps)) * 4.5e6;
  const pkp = Math.floor(Math.max(0, neto - ptkp) / 1000) * 1000;
  let tax = 0; let prev = 0; const parts = [];
  for (const [cap, rate] of BRACKETS) {
    if (pkp <= prev) break;
    const slice = Math.min(pkp, cap) - prev;
    parts.push({ rate, slice, tax: slice * rate }); tax += slice * rate; prev = cap;
  }
  return { annual, jabatan, iuran, neto, ptkp, pkp, tax, monthly: tax / 12, parts, takeHome: gross - pension - tax / 12 };
}

// ---------- import ----------
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };
// Day-first dates, as written in Indonesia. `loose` allows dots as separators (spreadsheet cells);
// free text keeps to - and / so that "1.250.000" is never read as a date.
export function parseDate(v, loose = true) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : /^\d{5}(\.\d+)?$/.test(String(v).trim()) ? Number(v) : NaN;
  if (n > 20000 && n < 80000) { // spreadsheet serial day
    const d = new Date(Math.round((n - 25569) * DAY));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours() || 12, d.getUTCMinutes()).getTime();
  }
  const s = String(v); const sep = loose ? '[-/.]' : '[-/]';
  let m = s.match(new RegExp(`\\b(\\d{4})${sep}(\\d{1,2})${sep}(\\d{1,2})(?:[T ,]+(\\d{1,2})[:.](\\d{2}))?`));
  if (m) return new Date(+m[1], m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0)).getTime();
  m = s.match(new RegExp(`\\b(\\d{1,2})${sep}(\\d{1,2})${sep}(\\d{4}|\\d{2})\\b(?:[ ,]+(\\d{1,2})[:.](\\d{2}))?`));
  if (m && +m[2] <= 12 && +m[1] <= 31) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], m[2] - 1, +m[1], +(m[4] ?? 12), +(m[5] ?? 0)).getTime();
  m = s.match(/\b(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})(?:[ ,]+(?:pukul\s+)?(\d{1,2})[:.](\d{2}))?/);
  if (m && MON[m[2].toLowerCase()] != null) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1], +(m[4] ?? 12), +(m[5] ?? 0)).getTime();
  return null;
}
export function parseCsv(input) {
  const text = input.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}
// First worksheet of an .xlsx file as rows of cells. Reads values only, no formulas or styles.
export function readXlsx(buf) {
  const zip = unzipSync(new Uint8Array(buf));
  const xml = (name) => (zip[name] ? new DOMParser().parseFromString(strFromU8(zip[name]), 'application/xml') : null);
  const shared = [...(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') || [])]
    .map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  const sheet = Object.keys(zip).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  const doc = sheet && xml(sheet);
  if (!doc) return [];
  const rows = [];
  for (const r of doc.getElementsByTagName('row')) {
    const out = [];
    for (const c of r.getElementsByTagName('c')) {
      let col = 0;
      for (const ch of (c.getAttribute('r') || '').replace(/\d+/g, '')) col = col * 26 + (ch.charCodeAt(0) - 64);
      const t = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent;
      const val = t === 's' ? shared[Number(v)] : t === 'inlineStr' ? c.getElementsByTagName('t')[0]?.textContent : t === 'str' ? v : v == null ? '' : Number(v);
      out[(col || out.length + 1) - 1] = val ?? '';
    }
    rows.push(Array.from(out, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}
const HEAD = {
  date: /^(date|tanggal|tgl|waktu|time)/i, amount: /^(amount|jumlah|nominal|nilai|total)/i,
  debit: /(debit|debet|keluar|pengeluaran|withdraw)/i, credit: /(kredit|credit|masuk|pemasukan|deposit)/i,
  note: /(note|catatan|keterangan|deskripsi|description|uraian|memo|berita|remark)/i, type: /^(type|tipe|jenis)/i,
  category: /(categor|kategori)/i, account: /^(account|akun|dompet|rekening)/i, tags: /^tag/i,
};
const byRecordName = (records, kind, text) => {
  const low = String(text || '').trim().toLowerCase();
  return low ? live(records, kind).find((r) => [r.name, r.names?.id, r.names?.en].some((n) => n && n.toLowerCase() === low)) : null;
};
function candidate(records, settings, { time, type, amount, note, catName, accName, tags }) {
  const cat = (catName && live(records, 'category').find((c) => c.type === type && byRecordName(records, 'category', catName)?.id === c.id))
    || matchRule(note, records, type) || catByName(note, records, type) || fallbackCat(records, type);
  const acc = byRecordName(records, 'account', accName) || records[settings.lastAccountId] || live(records, 'account')[0];
  return { time, type, amount: Math.round(Math.abs(amount) * 100) / 100, note: String(note || '').trim().slice(0, 120), categoryId: cat?.id || null, accountId: acc?.id, tags: tags || [] };
}
// Turns spreadsheet rows into bill candidates. Understands this app's own CSV export and the usual
// bank layouts (date + description + amount, or date + description + debit + credit).
export function rowsToCandidates(rows, records, settings) {
  if (!rows.length) return { list: [], skipped: 0 };
  const head = rows[0].map((x) => String(x).trim());
  const col = {};
  for (const k of Object.keys(HEAD)) { const i = head.findIndex((h, j) => HEAD[k].test(h) && !Object.values(col).includes(j)); if (i >= 0) col[k] = i; }
  let body = rows.slice(1);
  if (col.date == null || (col.amount == null && col.debit == null && col.credit == null)) { // no usable header: guess from the first row
    body = rows; const r = rows[0];
    for (const k of Object.keys(col)) delete col[k];
    col.date = r.findIndex((x) => parseDate(x) != null);
    col.amount = r.findIndex((x, i) => i !== col.date && !Number.isNaN(parseNumber(x)) && String(x).trim() !== '');
    col.note = r.reduce((best, x, i) => (i !== col.date && i !== col.amount && String(x).length > String(r[best] ?? '').length ? i : best), -1);
    if (col.date < 0 || col.amount < 0) return { list: [], skipped: rows.length };
  }
  const anyNeg = col.amount != null && body.some((r) => parseNumber(r[col.amount]) < 0);
  const list = []; let skipped = 0;
  for (const r of body) {
    const time = parseDate(r[col.date]);
    const kind = String(r[col.type] ?? '').toLowerCase();
    let n; let type;
    if (col.amount != null) n = parseNumber(r[col.amount]);
    else { const d = parseNumber(r[col.debit]) || 0; const c = parseNumber(r[col.credit]) || 0; n = c > 0 ? c : -Math.abs(d); }
    if (/transfer/.test(kind) || time == null || !n || Number.isNaN(n)) { skipped++; continue; }
    if (/income|masuk|pemasukan|kredit|credit/.test(kind)) type = 'income';
    else if (/expense|keluar|pengeluaran|debit/.test(kind)) type = 'expense';
    else if (col.amount == null) type = n > 0 ? 'income' : 'expense';
    else type = n < 0 ? 'expense' : anyNeg ? 'income' : 'expense';
    list.push(candidate(records, settings, {
      time, type, amount: n, note: r[col.note] ?? '', catName: r[col.category], accName: r[col.account],
      tags: String(r[col.tags] ?? '').split(/[,;#\s]+/).filter(Boolean),
    }));
  }
  return { list, skipped };
}
// Pasted bank / e-wallet notifications or e-mail text: one candidate per paragraph that names an amount.
export function parseNotifText(text, records, settings, now = Date.now()) {
  const blocks = /\n\s*\n/.test(text) ? text.split(/\n\s*\n/) : text.split(/\n/);
  const list = []; let skipped = 0;
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const m = block.match(/(?:rp\.?|idr)\s*([\d.,]*\d)/i);
    const amount = m ? parseNumber(m[1]) : NaN;
    if (!(amount > 0)) { skipped++; continue; }
    const type = /(masuk|diterima|menerima|received|credited|dana masuk|transfer dari|top ?up ke saldo)/i.test(block) ? 'income' : 'expense';
    const who = block.match(/\b(?:di|ke|kepada|dari|at|to|from|merchant:?)\s+([A-Z0-9][^\n,.;]{2,40})/);
    // The merchant or person, without the trailing date ("... pada 14/11/2026 berhasil").
    const note = (who ? who[1].replace(/\s+(pada|on|tanggal|tgl)\b.*$/i, '').replace(/\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}.*$/, '') : block.replace(/\s+/g, ' ')).trim().slice(0, 60);
    list.push(candidate(records, settings, { time: parseDate(block, false) ?? now, type, amount, note }));
  }
  return { list, skipped };
}
export const looseKey = (b) => `${dayKeyOf(b.time)}|${b.type}|${Math.round(b.amount * 100)}`;
// Groups of saved bills that look like the same transaction entered twice.
export function findDuplicates(bills) {
  const m = new Map();
  for (const b of bills) {
    const k = `${looseKey(b)}|${b.accountId}|${(b.note || '').trim().toLowerCase()}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(b);
  }
  return [...m.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => (a.createdAt || a.time) - (b.createdAt || b.time)));
}

// ---------- receipt photos: compressed, kept on this device only (IndexedDB), never synced ----------
let dbp;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open('kasku-photos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('p');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction('p', mode); const q = fn(t.objectStore('p')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); });
};
export const putPhoto = (id, url) => tx('readwrite', (s) => s.put(url, id));
export const getPhoto = (id) => tx('readonly', (s) => s.get(id));
export const delPhoto = (id) => tx('readwrite', (s) => s.delete(id));
export async function compressImage(file, max = 1280, quality = 0.7) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
export { nameOf };
