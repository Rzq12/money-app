// Price proxy for the portfolio on the web: Yahoo Finance sends no CORS header, so browsers
// cannot read it directly. The Android/iOS app calls Yahoo itself and does not use this.
// POST { symbols: ["BBCA.JK", "AAPL", "BTC-USD", "GC=F", "USDIDR=X"] }
//   → { ok: true, quotes: { [symbol]: {price, prev, currency, time, name} | null } }
// null = the market has no such symbol; a symbol missing from `quotes` could not be fetched.

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Json) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SYMBOL = /^[A-Z0-9][A-Z0-9.=^-]{0,19}$/;
const MAX = 40;

function readMeta(json: Json) {
  const m = json?.chart?.result?.[0]?.meta;
  if (!m || typeof m.regularMarketPrice !== 'number') return null;
  let price = m.regularMarketPrice; let currency = m.currency || 'USD';
  let prev = m.chartPreviousClose ?? m.previousClose ?? null;
  if (currency === 'GBp' || currency === 'GBX') { price /= 100; prev = prev == null ? null : prev / 100; currency = 'GBP'; }
  return { price, prev, currency, time: (m.regularMarketTime || 0) * 1000, name: m.shortName || m.longName || null };
}

export async function handle(req: Request, http: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method' });
  let body: Json;
  try { body = await req.json(); } catch { return reply(400, { ok: false, error: 'bad_request' }); }
  const symbols = Array.isArray(body?.symbols)
    ? [...new Set(body.symbols.map((s: unknown) => String(s).toUpperCase()).filter((s: string) => SYMBOL.test(s)))].slice(0, MAX) as string[]
    : [];
  if (!symbols.length) return reply(400, { ok: false, error: 'bad_request' });

  const quotes: Record<string, Json> = {};
  await Promise.all(symbols.map(async (s) => {
    try {
      const res = await http(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=1d&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kasku+)' }, signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 404) { quotes[s] = null; return; }
      if (!res.ok) return;
      quotes[s] = readMeta(await res.json());
    } catch { /* left out: could not be fetched */ }
  }));
  return reply(200, { ok: true, quotes });
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handle(req));
