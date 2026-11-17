// Money formatting, balances, budgets and the two calculators.
// Every expectation is the correct result (MECHANICS.md or a hand calculation); a failing test is a bug.
import { describe, it, expect } from 'vitest';
import { fresh } from './setup.js';

const nb = (s) => s.replace(/ /g, ' ');
const T = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

describe('formatMoney (MECHANICS #1, #2)', () => {
  it('min 0, max 2 decimals', async () => {
    const { formatMoney } = await fresh();
    expect(nb(formatMoney(1234.5, 'IDR', 'id'))).toBe('Rp 1.234,5');
    expect(nb(formatMoney(1234.567, 'IDR', 'id'))).toBe('Rp 1.234,57');
    expect(nb(formatMoney(25000, 'IDR', 'id'))).toBe('Rp 25.000');
    expect(formatMoney(1234.5, 'USD', 'en')).toBe('$1,234.5');
  });
  it('whole drops decimals (weekly totals)', async () => {
    const { formatMoney } = await fresh();
    expect(nb(formatMoney(1234.56, 'IDR', 'id', { whole: true }))).toBe('Rp 1.235');
  });
  it('zero, negative, huge, float noise, NaN', async () => {
    const { formatMoney } = await fresh();
    expect(nb(formatMoney(0, 'IDR', 'id'))).toBe('Rp 0');
    expect(nb(formatMoney(-5000, 'IDR', 'id'))).toBe('-Rp 5.000');
    expect(nb(formatMoney(1e15, 'IDR', 'id'))).toBe('Rp 1.000.000.000.000.000');
    expect(nb(formatMoney(0.1 + 0.2, 'IDR', 'id'))).toBe('Rp 0,3');
    expect(nb(formatMoney('abc', 'IDR', 'id'))).toBe('Rp 0');
  });
});

describe('accountBalances', () => {
  it('add, edit, delete and transfer', async () => {
    const { store, accountBalances } = await fresh();
    store.put({ id: 'acc-cash', initBalance: 100000 });
    const base = { kind: 'bill', bookId: 'book-default', time: T(2026, 11, 18) };
    store.put({ ...base, id: 'b1', type: 'expense', amount: 25000, accountId: 'acc-cash', categoryId: 'cat-food' });
    store.put({ ...base, id: 'b2', type: 'income', amount: 10000, accountId: 'acc-cash', categoryId: 'cat-wage' });
    store.put({ ...base, id: 'b3', type: 'transfer', amount: 50000, accountId: 'acc-cash', toAccountId: 'acc-bank' });
    store.put({ id: 'b1', amount: 30000 }); // edit
    store.remove('b2'); // delete
    const bal = accountBalances(store.get().records);
    expect(bal['acc-cash']).toBe(20000);
    expect(bal['acc-bank']).toBe(50000);
  });
  it('transfer IDR -> USD converts at the saved rate', async () => {
    const { store, accountBalances } = await fresh();
    store.put({ id: 'acc-usd', kind: 'account', type: 'debit', name: 'USD', currency: 'USD', initBalance: 0 });
    store.put({ id: 'rate-USD', kind: 'rate', code: 'USD', rate: 16000 });
    store.put({ id: 't1', kind: 'bill', type: 'transfer', amount: 160000, accountId: 'acc-cash', toAccountId: 'acc-usd', time: T(2026, 11, 18) });
    expect(accountBalances(store.get().records)['acc-usd']).toBe(10);
  });
  it('BUG-007: without a rate, Rp 160.000 must not arrive as US$160.000', async () => {
    const { store, accountBalances } = await fresh();
    store.put({ id: 'acc-usd', kind: 'account', type: 'debit', name: 'USD', currency: 'USD', initBalance: 0 });
    store.put({ id: 't1', kind: 'bill', type: 'transfer', amount: 160000, accountId: 'acc-cash', toAccountId: 'acc-usd', time: T(2026, 11, 18) });
    expect(accountBalances(store.get().records)['acc-usd']).not.toBe(160000);
  });
});

describe('budgetSpent / rangeOf', () => {
  const settings = { lang: 'id', currency: 'IDR' };
  it('counts only this month, this book, this category, in the main currency', async () => {
    const { store, budgetSpent } = await fresh();
    store.put({ id: 'acc-usd', kind: 'account', type: 'debit', name: 'USD', currency: 'USD' });
    store.put({ id: 'rate-USD', kind: 'rate', code: 'USD', rate: 16000 });
    const bill = (id, x) => store.put({ id, kind: 'bill', type: 'expense', accountId: 'acc-cash', categoryId: 'cat-food', bookId: 'book-default', ...x });
    bill('a', { amount: 30000, time: T(2026, 11, 2) });
    bill('b', { amount: 20000, time: T(2026, 10, 31, 23, 59) }); // last month
    bill('c', { amount: 10000, time: T(2026, 11, 3), categoryId: 'cat-daily' });
    bill('d', { amount: 99999, time: T(2026, 11, 3), bookId: 'other' });
    bill('e', { amount: 5, time: T(2026, 11, 4), accountId: 'acc-usd' });
    const b = { bookId: 'book-default', categoryId: 'cat-food', period: 'month' };
    expect(budgetSpent(b, store.get().records, settings, T(2026, 11, 18)).spent).toBe(30000 + 80000);
  });
  it('custom range includes the whole last day', async () => {
    const { store, budgetSpent, fromDateInput } = await fresh();
    const bill = (id, time) => store.put({ id, kind: 'bill', type: 'expense', amount: 1, accountId: 'acc-cash', categoryId: 'cat-food', bookId: 'book-default', time });
    bill('in1', T(2026, 11, 1, 0, 0)); bill('in2', T(2026, 11, 30, 23, 59)); bill('out', T(2026, 12, 1, 0, 0));
    const b = { bookId: 'book-default', period: 'custom', start: fromDateInput('2026-11-01', 0), end: fromDateInput('2026-11-30', 0) };
    expect(budgetSpent(b, store.get().records, settings, T(2026, 11, 18)).spent).toBe(2);
  });
  it('week starts on Sunday 00:00 for id-ID and en-US (MECHANICS #4)', async () => {
    const { rangeOf, firstDayOfWeek } = await fresh();
    expect(firstDayOfWeek('id')).toBe(0);
    expect(firstDayOfWeek('en')).toBe(0);
    const [s, e] = rangeOf('week', T(2026, 11, 18), 'id'); // Wednesday
    expect(new Date(s).getDay()).toBe(0);
    expect(new Date(s).getHours()).toBe(0);
    expect(e - s).toBe(7 * 86400000);
    const [s2] = rangeOf('week', T(2026, 11, 15, 0, 0), 'id'); // Sunday 00:00 opens its own week
    expect(s2).toBe(T(2026, 11, 15, 0, 0));
    const [s3] = rangeOf('week', T(2026, 11, 21, 23, 59), 'id'); // Saturday 23:59 still the same week
    expect(s3).toBe(T(2026, 11, 15, 0, 0));
  });
  it('month and leap-year edges', async () => {
    const { rangeOf } = await fresh();
    expect(rangeOf('month', T(2026, 12, 31, 23, 59), 'id')).toEqual([T(2026, 12, 1, 0), T(2027, 1, 1, 0)]);
    const [s, e] = rangeOf('month', T(2028, 2, 29), 'id');
    expect((e - s) / 86400000).toBe(29);
  });
});

describe('kpr (hand calculation)', () => {
  it('Rp 500 jt, DP 20%, 7%, 15 years', async () => {
    const { kpr } = await fresh();
    const r = kpr({ price: 500e6, dpPct: 20, ratePct: 7, years: 15 });
    const i = 0.07 / 12; const n = 180; const loan = 400e6;
    const pay = (loan * i * (1 + i) ** n) / ((1 + i) ** n - 1);
    expect(r.loan).toBe(loan); expect(r.dp).toBe(100e6); expect(r.n).toBe(180);
    expect(Math.round(r.pay)).toBe(3595313);
    expect(r.pay).toBeCloseTo(pay, 6);
    let bal = loan; for (let k = 0; k < n; k++) bal = bal * (1 + i) - r.pay;
    expect(Math.abs(bal)).toBeLessThan(1);
    expect(r.rows[0].int).toBeCloseTo(loan * i, 6);
  });
  it('0% interest and 100% DP', async () => {
    const { kpr } = await fresh();
    expect(kpr({ price: 120e6, dpPct: 0, ratePct: 0, years: 1 }).pay).toBe(10e6);
    expect(kpr({ price: 120e6, dpPct: 100, ratePct: 7, years: 1 }).pay).toBe(0);
  });
});

describe('pph21 (UU HPP, Pasal 17)', () => {
  it('Rp 10 jt/bulan TK/0 -> Rp 250.000/bulan', async () => {
    const { pph21 } = await fresh();
    const r = pph21({ gross: 10e6 });
    expect([r.annual, r.jabatan, r.neto, r.ptkp, r.pkp, r.tax, r.monthly]).toEqual([120e6, 6e6, 114e6, 54e6, 60e6, 3e6, 250000]);
  });
  it('Rp 20 jt/bulan K/1 -> Rp 19,65 jt/tahun', async () => {
    const { pph21 } = await fresh();
    const r = pph21({ gross: 20e6, married: true, deps: 1 });
    expect(r.ptkp).toBe(63e6); expect(r.pkp).toBe(171e6); expect(r.tax).toBeCloseTo(19.65e6, 2);
  });
  it('Rp 60 jt/bulan TK/0 crosses four brackets -> Rp 142 jt/tahun', async () => {
    const { pph21 } = await fresh();
    expect(pph21({ gross: 60e6 }).tax).toBeCloseTo(142e6, 2);
  });
  it('PKP rounded down to thousands, dependants capped at 3', async () => {
    const { pph21 } = await fresh();
    expect(pph21({ gross: 5_000_100 }).pkp % 1000).toBe(0);
    expect(pph21({ gross: 10e6, deps: 5 }).ptkp).toBe(54e6 + 3 * 4.5e6);
  });
});

describe('splitTotals', () => {
  it('service then tax on (subtotal + service), shares add up', async () => {
    const { splitTotals } = await fresh();
    const r = splitTotals({ people: ['A', 'B', 'C'], items: [{ price: 100000, who: [] }], servicePct: 5, taxPct: 10 });
    expect([r.subtotal, r.service, r.tax, r.total]).toEqual([100000, 5000, 10500, 115500]);
    expect(r.per.reduce((a, v) => a + v, 0)).toBeCloseTo(115500, 6);
  });
});
