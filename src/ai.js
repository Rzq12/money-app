// Client for the `ai` Edge Function. Every caller keeps a non-AI fallback for when this throws.
import { useSyncExternalStore } from 'react';
import { store, live, nameOf } from './store.js';
import { supabaseUrl, supabaseKey, configured, ensureToken, accessToken } from './sync.js';
import { toDateInput } from './logic.js';

const OFF_KEY = 'kasku.v1.aiOff';
let state = { off: (() => { try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; } })(), remaining: null, configured: null };
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
export const useAi = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
export function setAiOff(off) { try { localStorage.setItem(OFF_KEY, off ? '1' : '0'); } catch { /* per-device preference only */ } set({ off }); }

export class AiError extends Error { constructor(code) { super(code); this.code = code; } }

// Names the user's own categories and wallets so the model can only pick from them.
export function context() {
  const { records, settings } = store.get();
  const lang = settings.lang;
  return {
    lang, today: toDateInput(Date.now()),
    categories: live(records, 'category').map((c) => ({ id: c.id, name: nameOf(c, lang), type: c.type })),
    accounts: live(records, 'account').filter((a) => !a.archived).map((a) => ({ id: a.id, name: nameOf(a, lang) })),
  };
}

export async function callAI(task, payload) {
  if (state.off) throw new AiError('off');
  if (!configured) throw new AiError('not_configured');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('offline');
  try { await ensureToken(); } catch { throw new AiError('offline'); }
  let res;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/ai`, {
      method: 'POST', signal: AbortSignal.timeout(40_000),
      headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload }),
    });
  } catch (e) { throw new AiError(e?.name === 'TimeoutError' ? 'timeout' : 'offline'); }
  const data = await res.json().catch(() => ({}));
  if (typeof data.remaining === 'number') set({ remaining: data.remaining });
  if (!res.ok || !data.ok) {
    if (data.error === 'not_configured') set({ configured: false });
    if (data.error === 'limit') set({ remaining: 0 });
    throw new AiError(data.error || (res.status === 404 ? 'not_configured' : 'provider'));
  }
  set({ configured: true });
  return data.result;
}

// The stored summary for 'YYYY-MM', or {} when there is none.
export async function getSummary(month) {
  if (state.off || !configured || !accessToken()) return {};
  await ensureToken();
  const res = await fetch(`${supabaseUrl}/rest/v1/ai_summaries?select=text,generated_at&month=eq.${month}`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken()}` } });
  const rows = res.ok ? await res.json() : [];
  return rows[0] ? { text: rows[0].text, generatedAt: rows[0].generated_at } : {};
}

// Short reason for the interface, from an AiError code.
export const aiReason = (t, e) => t.aiErr[e?.code] || t.aiErr.provider;
