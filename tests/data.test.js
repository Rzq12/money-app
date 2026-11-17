// Recurring bills, storage, import parsing, sync row mapping and translations.
// Every expectation is the correct behaviour; a failing test is a bug (IDs match the QA report).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fresh } from './setup.js';

const T = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const settings = { lang: 'id', currency: 'IDR', lastAccountId: 'acc-cash', bookId: 'book-default' };
const rec = (x) => ({ id: 'r1', kind: 'recurring', type: 'expense', amount: 50000, categoryId: 'cat-food', accountId: 'acc-cash', bookId: 'book-default', active: true, ...x });

describe('runRecurring', () => {
  it('monthly on the 31st: Feb 28, never twice when run again', async () => {
    const { store, runRecurring, live, dayKeyOf } = await fresh();
    store.put(rec({ freq: 'monthly', next: T(2026, 1, 31, 9), day: 31 }));
    expect(runRecurring(T(2026, 11, 18))).toBe(10);
    expect(runRecurring(T(2026, 11, 18))).toBe(0);
    const days = live(store.get().records, 'bill').map((b) => dayKeyOf(b.time)).sort();
    expect(days).toContain('2026-02-28'); expect(days).toContain('2026-03-31'); expect(days).toContain('2026-04-30');
  });
  it('leap year: Jan 31 2028 -> Feb 29 2028', async () => {
    const { store, runRecurring, live, dayKeyOf } = await fresh();
    store.put(rec({ freq: 'monthly', next: T(2028, 1, 31, 9), day: 31 }));
    runRecurring(T(2028, 3, 1));
    expect(live(store.get().records, 'bill').map((b) => dayKeyOf(b.time))).toContain('2028-02-29');
  });
  it('BUG-014: a daily schedule not opened for 500 days catches up in one go', async () => {
    const { store, runRecurring } = await fresh();
    const now = T(2026, 11, 18, 10);
    store.put(rec({ freq: 'daily', next: now - 500 * 86400000 }));
    expect(runRecurring(now)).toBe(501);
  });
  it('BUG-002: a bill deleted on another device stays deleted when a stale device runs the schedule', async () => {
    const { store, runRecurring } = await fresh();
    // Device B still has the schedule at Nov 1; device A already made and deleted r1@2026-11-01.
    store.put(rec({ freq: 'monthly', next: T(2026, 11, 1, 9), day: 1 }));
    runRecurring(T(2026, 11, 18)); // runs on app open, before the first pull finishes
    store.merge([{ id: 'r1@2026-11-01', kind: 'bill', type: 'expense', amount: 50000, deleted: true, updatedAt: Date.now() - 60_000 }]);
    expect(store.get().records['r1@2026-11-01'].deleted).toBe(true);
  });
});

describe('local storage', () => {
  it('BUG-009: a corrupted records blob is not silently overwritten', async () => {
    localStorage.setItem('kasku.v1.records', '{"bill-1":{"id":"bill-1","kind":"bill","amount":5');
    const { store } = await fresh();
    store.put({ id: 'x', kind: 'bill', type: 'expense', amount: 1, time: Date.now() });
    const all = [...localStorage.m.values()].join('\n');
    expect(all).toContain('bill-1');
  });
  it('BUG-008: storage full -> the save is refused, not kept only in memory', async () => {
    const { store } = await fresh();
    localStorage.full = true;
    let threw = false;
    try { store.put({ id: 'y', kind: 'bill', type: 'expense', amount: 1, time: Date.now() }); } catch { threw = true; }
    const inMemory = !!store.get().records.y; const onDisk = (localStorage.getItem('kasku.v1.records') || '').includes('"y"');
    expect({ threw, consistent: inMemory === onDisk }).toEqual({ threw: false, consistent: true });
  });
});

describe('quick entry and import parsing', () => {
  it('parseNumber understands Indonesian and English separators', async () => {
    const { parseNumber } = await fresh();
    expect(parseNumber('1.250.000')).toBe(1250000);
    expect(parseNumber('Rp 25.000,50')).toBe(25000.5);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('(25.000)')).toBe(-25000);
    expect(parseNumber('1,250,000.75')).toBe(1250000.75);
  });
  it('BUG-016: "makan 2 porsi 25rb" is Rp 25.000, not Rp 2', async () => {
    const { parseAmount } = await fresh();
    expect(parseAmount('makan 2 porsi 25rb')?.value).toBe(25000);
  });
  it('BUG-005: CSV exported by the app imports back on the same date and time', async () => {
    const { store, rowsToCandidates } = await fresh();
    const time = T(2026, 11, 18, 0, 30); // 00:30 WIB
    const rows = [['date', 'type', 'category', 'account', 'to_account', 'member', 'amount', 'note', 'tags'],
      [new Date(time).toISOString(), 'expense', 'Makan', 'Tunai', '', 'Diri sendiri', 25000, 'nasi', '']];
    const [c] = rowsToCandidates(rows, store.get().records, settings).list;
    expect(c.categoryId).toBe('cat-food');
    expect(c.time).toBe(time);
  });
  it('BUG-006: headerless row with the amount before the date', async () => {
    const { store, rowsToCandidates } = await fresh();
    const [c] = rowsToCandidates([['Kopi', 25000, '18/11/2026']], store.get().records, settings).list;
    expect(c?.amount).toBe(25000);
    expect(c?.time).toBe(T(2026, 11, 18));
  });
  it('bank layout with debit / credit columns', async () => {
    const { store, rowsToCandidates } = await fresh();
    const rows = [['Tanggal', 'Keterangan', 'Debit', 'Kredit'], ['01/11/2026', 'Indomaret', '25.000', ''], ['02/11/2026', 'Gaji', '', '5.000.000']];
    const { list } = rowsToCandidates(rows, store.get().records, settings);
    expect(list.map((c) => [c.type, c.amount])).toEqual([['expense', 25000], ['income', 5000000]]);
  });
  it('bad files give no rows instead of throwing', async () => {
    const { store, rowsToCandidates, parseCsv } = await fresh();
    expect(rowsToCandidates(parseCsv('hello\nworld'), store.get().records, settings).list).toEqual([]);
    expect(rowsToCandidates([], store.get().records, settings).list).toEqual([]);
  });
});

describe('sync row mapping', () => {
  it('every field the screens save survives a round trip through the table row', async () => {
    const { _test } = await import('../src/sync.js');
    const { KINDS, toRow, fromRow } = _test;
    const samples = {
      bill: { id: 'b', kind: 'bill', type: 'transfer', amount: 12.5, time: T(2026, 11, 18), bookId: 'book-default', accountId: 'acc-cash', toAccountId: 'acc-bank', categoryId: null, memberId: 'mem-me', note: 'x', hasPhoto: true, goalId: 'g', recurringId: 'r', createdAt: 5, updatedAt: 9, deleted: false },
      account: { id: 'a', kind: 'account', type: 'credit', name: 'Kartu 😀', icon: 'card', color: '#000000', currency: 'USD', initBalance: -10.25, note: 'n', order: 3, archived: true, updatedAt: 9, deleted: false },
      recurring: { id: 'r', kind: 'recurring', type: 'expense', amount: 1, bookId: 'b', accountId: 'a', toAccountId: null, categoryId: 'c', memberId: 'mem-me', note: '', freq: 'monthly', next: T(2026, 12, 1, 9), day: 1, active: false, updatedAt: 9, deleted: false },
      budget: { id: 'bu', kind: 'budget', bookId: 'b', categoryId: null, amount: 5, period: 'custom', start: T(2026, 11, 1, 0), end: T(2026, 11, 30, 0), updatedAt: 9, deleted: false },
      holding: { id: 'h', kind: 'holding', type: 'kripto', name: 'BTC', symbol: 'BTC', units: 0.00000001, buyPrice: 1, price: 2, priceAt: 7, order: 1, updatedAt: 9, deleted: false },
    };
    for (const [kind, r] of Object.entries(samples)) {
      const back = fromRow(JSON.parse(JSON.stringify(toRow(r, KINDS[kind], 'u'))), KINDS[kind], kind);
      for (const [k, v] of Object.entries(r)) if (v != null && v !== '') expect([kind, k, back[k]]).toEqual([kind, k, v]);
    }
  });
});

describe('translations', () => {
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  it('Indonesian and English have the same keys', async () => {
    const { dict } = await import('../src/i18n.js');
    const id = new Set(flat(dict.id)); const en = new Set(flat(dict.en));
    expect([...id].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !id.has(k))).toEqual([]);
  });
  it('every t.key used in the screens exists', async () => {
    const { dict } = await import('../src/i18n.js');
    const used = new Set();
    for (const f of readdirSync('src').filter((n) => n.endsWith('.jsx'))) {
      for (const m of readFileSync(`src/${f}`, 'utf8').matchAll(/\bt\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) used.add(m[1]);
    }
    const missing = [...used].filter((k) => !(k in dict.id) || !(k in dict.en));
    expect(missing).toEqual([]);
  });
});
