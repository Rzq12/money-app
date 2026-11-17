// Runs before every test file: Jakarta time (the app's main audience), a controllable
// localStorage and a browser-like navigator. Each test gets a fresh store through fresh().
import { vi, beforeEach } from 'vitest';

process.env.TZ = 'Asia/Jakarta';

class MemoryStorage {
  constructor() { this.m = new Map(); this.full = false; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) {
    if (this.full) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, String(v));
  }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const ls = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US', onLine: true }, configurable: true, writable: true });

beforeEach(() => { ls.clear(); ls.full = false; navigator.language = 'en-US'; vi.resetModules(); });

// Fresh copies of the modules, so the store's module-level state starts from localStorage again.
export async function fresh() {
  const store = await import('../src/store.js');
  const logic = await import('../src/logic.js');
  return { ...store, ...logic };
}
