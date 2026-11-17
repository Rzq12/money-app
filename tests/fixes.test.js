// Regression tests for the QA fixes that the first two files do not already cover.
import { describe, it, expect } from 'vitest';
import { fresh } from './setup.js';

const T = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

describe('recurring schedules', () => {
  it('BUG-015: resuming a paused schedule waits for its next date', async () => {
    const { nextAfter } = await fresh();
    // Monthly on the 5th, paused since September; resumed on Nov 18 -> Dec 5, not today.
    expect(nextAfter(T(2026, 9, 5, 9), 'monthly', 5, T(2026, 11, 18))).toBe(T(2026, 12, 5, 9));
  });
  it('BUG-002: a pause made on another device wins over the schedule moving on here', async () => {
    const { store, runRecurring } = await fresh();
    store.put({ id: 'r1', kind: 'recurring', type: 'expense', amount: 1, categoryId: 'cat-food', accountId: 'acc-cash', bookId: 'book-default', freq: 'monthly', day: 1, next: T(2026, 11, 1, 9), active: true }, { at: 1000 });
    runRecurring(T(2026, 11, 18));
    store.merge([{ ...store.get().records.r1, next: T(2026, 11, 1, 9), active: false, updatedAt: 5000 }]);
    expect(store.get().records.r1.active).toBe(false);
  });
});

describe('store', () => {
  it('BUG-027: keepTime writes do not move updatedAt', async () => {
    const { store } = await fresh();
    store.put({ id: 'h1', kind: 'holding', price: 1 }, { at: 1234 });
    store.putMany([{ id: 'h1', price: 2 }], { keepTime: true });
    expect(store.get().records.h1).toMatchObject({ price: 2, updatedAt: 1234 });
  });
  it('BUG-018: erasing local data forgets the chat history', async () => {
    const { store, CHAT_KEY } = await fresh();
    localStorage.setItem(CHAT_KEY, '[{"role":"user","text":"hi"}]');
    store.resetAll();
    expect(localStorage.getItem(CHAT_KEY)).toBe(null);
  });
  it('BUG-008: storage full reports the error and keeps the old copy', async () => {
    const { store } = await fresh();
    const errors = []; store.onError((e) => errors.push(e.name));
    localStorage.full = true;
    expect(store.put({ id: 'z', kind: 'bill', amount: 1 })).toBe(null);
    expect(store.setSettings({ dark: true })).toBe(false);
    expect([errors.length, store.get().settings.dark, store.get().records.z]).toEqual([2, false, undefined]);
  });
});

describe('rates and transfers', () => {
  it('BUG-007: missingRates lists currencies without a rate', async () => {
    const { store, missingRates } = await fresh();
    store.put({ id: 'acc-usd', kind: 'account', type: 'debit', name: 'USD', currency: 'USD' });
    store.put({ id: 'acc-eur', kind: 'account', type: 'debit', name: 'EUR', currency: 'EUR' });
    store.put({ id: 'rate-EUR', kind: 'rate', code: 'EUR', rate: 17000 });
    expect(missingRates(store.get().records, 'IDR')).toEqual(['USD']);
  });
  it('same-currency transfers still move the full amount', async () => {
    const { store, accountBalances } = await fresh();
    store.put({ id: 't', kind: 'bill', type: 'transfer', amount: 5000, accountId: 'acc-cash', toAccountId: 'acc-bank', time: T(2026, 11, 18) });
    expect(accountBalances(store.get().records)['acc-bank']).toBe(5000);
  });
});

describe('quick entry', () => {
  it('BUG-016: a unit or Rp beats a bare number; otherwise the largest number wins', async () => {
    const { parseAmount } = await fresh();
    expect(parseAmount('gaji 5 juta tanggal 25')?.value).toBe(5e6);
    expect(parseAmount('beli 3 kopi 45000')?.value).toBe(45000);
    expect(parseAmount('Rp 12.500 parkir 2 jam')?.value).toBe(12500);
  });
  it('BUG-005: the new local export format reads back exactly', async () => {
    const { parseDate } = await fresh();
    expect(parseDate('2026-11-18 00:30')).toBe(T(2026, 11, 18, 0, 30));
  });
});

describe('sync helpers', () => {
  it('sameContent ignores updatedAt and empty values', async () => {
    const { _test } = await import('../src/sync.js');
    const a = { id: 'b', kind: 'bill', amount: 1, note: '', tags: [], updatedAt: 1 };
    expect(_test.sameContent(a, { id: 'b', kind: 'bill', amount: 1, deleted: false, updatedAt: 9 })).toBe(true);
    expect(_test.sameContent(a, { id: 'b', kind: 'bill', amount: 2, updatedAt: 1 })).toBe(false);
  });
});
