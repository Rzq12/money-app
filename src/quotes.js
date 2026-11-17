// Live prices for the portfolio, from Yahoo Finance's chart endpoint (no API key).
// Yahoo sends no CORS header, so the route depends on where the app runs:
//   Android/iOS  → straight to Yahoo through CapacitorHttp (native networking, no CORS)
//   vite dev     → the /yahoo proxy in vite.config.js
//   built web    → the `quotes` Supabase Edge Function
import { CapacitorHttp } from '@capacitor/core';
import { isNative } from './native.js';
import { supabaseUrl, supabaseKey, configured } from './sync.js';

const YAHOO = 'https://query1.finance.yahoo.com';
const chartPath = (sym) => `/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
const TROY_OUNCE_GRAMS = 31.1034768;

// Holding types whose price can follow the market. Reksadana has no free feed and stays manual.
export const LIVE_KINDS = ['saham', 'saham_luar', 'kripto', 'emas'];
export const GOLD = 'XAU'; // symbol stored on an emas holding that follows the world gold price

// The code the user types, cleaned for storage: "bbca.jk" → "BBCA", " btc " → "BTC".
export function cleanSymbol(type, s) {
  let v = String(s || '').trim().toUpperCase().replace(/\s+/g, '');
  if (type === 'saham') v = v.replace(/\.JK$/, '');
  if (type === 'kripto') v = v.replace(/-(USD|IDR)$/, '');
  return v;
}

// Yahoo ticker for a holding, or null when its price is typed by hand.
export function yahooSymbol(h) {
  const sym = h.symbol || (h.type === 'saham' && /^[A-Za-z]{4}$/.test(h.name || '') ? h.name : ''); // older IDX holdings kept the code in the name
  if (!sym) return null;
  if (h.type === 'saham') return `${cleanSymbol('saham', sym)}.JK`;
  if (h.type === 'saham_luar') return cleanSymbol('saham_luar', sym);
  if (h.type === 'kripto') return `${cleanSymbol('kripto', sym)}-USD`;
  if (h.type === 'emas' && sym === GOLD) return 'GC=F';
  return null;
}

function readMeta(json) {
  const m = json?.chart?.result?.[0]?.meta;
  if (!m || typeof m.regularMarketPrice !== 'number') return null;
  let { regularMarketPrice: price, currency } = m;
  let prev = m.chartPreviousClose ?? m.previousClose ?? null;
  // London quotes in pence.
  if (currency === 'GBp' || currency === 'GBX') { price /= 100; prev = prev == null ? null : prev / 100; currency = 'GBP'; }
  return { price, prev, currency: currency || 'USD', time: (m.regularMarketTime || 0) * 1000, name: m.shortName || m.longName || null };
}

async function getJson(path) {
  if (isNative) {
    const r = await CapacitorHttp.get({ url: YAHOO + path, connectTimeout: 15000, readTimeout: 15000 });
    if (r.status === 404) return null;
    if (r.status >= 400) throw new Error(`http ${r.status}`);
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(`/yahoo${path}`, { signal: AbortSignal.timeout(15000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.json();
}

// { [yahooSymbol]: {price, prev, currency, time, name} | null }. null = unknown symbol.
// Throws when the price service cannot be reached at all.
export async function fetchQuotes(symbols) {
  const list = [...new Set(symbols.filter(Boolean))];
  if (!list.length) return {};
  if (!isNative && !import.meta.env.DEV) {
    if (!configured) throw new Error('not_configured');
    const r = await fetch(`${supabaseUrl}/functions/v1/quotes`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: list }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.ok) throw new Error(data?.error || `http ${r.status}`);
    return data.quotes;
  }
  const out = {}; let failed = 0;
  await Promise.all(list.map(async (s) => {
    try { out[s] = readMeta(await getJson(chartPath(s))); } catch { failed++; out[s] = undefined; }
  }));
  if (failed === list.length) throw new Error('unreachable');
  return out;
}

// Market listings matching what the user typed (code or company name), for the code picker.
// Returns [{symbol, name, exchange}] with symbol in the stored form (BBCA, AAPL, SOL).
const SEARCH_FILTER = {
  saham: (x) => x.exchange === 'JKT' && /\.JK$/.test(x.symbol),
  saham_luar: (x) => (x.quoteType === 'EQUITY' || x.quoteType === 'ETF') && x.exchange !== 'JKT',
  kripto: (x) => x.quoteType === 'CRYPTOCURRENCY' && /-USD$/.test(x.symbol),
};
export async function searchSymbols(type, text) {
  const q = String(text || '').trim();
  const keep = SEARCH_FILTER[type];
  if (q.length < 2 || !keep) return [];
  let found;
  if (!isNative && !import.meta.env.DEV) {
    if (!configured) throw new Error('not_configured');
    const r = await fetch(`${supabaseUrl}/functions/v1/quotes`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: q }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.ok) throw new Error(data?.error || `http ${r.status}`);
    found = data.results;
  } else {
    found = (await getJson(`/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&listsCount=0`))?.quotes || [];
  }
  const seen = new Set();
  return found.filter((x) => x?.symbol && keep(x)).map((x) => ({
    symbol: cleanSymbol(type, x.symbol),
    name: (x.longname || x.shortname || '').replace(/\s+USD$/, '').trim(),
    exchange: type === 'kripto' ? '' : x.exchDisp || x.exchange || '',
  })).filter((x) => !seen.has(x.symbol) && seen.add(x.symbol)).slice(0, 8);
}

// Current price per unit in the user's main currency for every holding that follows the market.
// Returns { [holdingId]: {price, native, currency, changePct, time, name} }.
export async function quoteHoldings(holdings, main) {
  const syms = Object.fromEntries(holdings.map((h) => [h.id, yahooSymbol(h)]).filter(([, s]) => s));
  const quotes = await fetchQuotes(Object.values(syms));
  const fxNeeded = [...new Set(Object.values(quotes).filter((q) => q && q.currency !== main).map((q) => `${q.currency}${main}=X`))];
  const fx = fxNeeded.length ? await fetchQuotes(fxNeeded) : {};
  const out = {};
  for (const h of holdings) {
    const q = quotes[syms[h.id]];
    if (!q) continue;
    const rate = q.currency === main ? 1 : fx[`${q.currency}${main}=X`]?.price;
    if (!rate) continue;
    const perUnit = h.type === 'emas' ? 1 / TROY_OUNCE_GRAMS : 1; // gold is quoted per troy ounce, held in grams
    out[h.id] = {
      price: q.price * rate * perUnit, native: q.price * perUnit, currency: q.currency,
      changePct: q.prev ? ((q.price - q.prev) / q.prev) * 100 : null, time: q.time,
      name: h.type === 'kripto' && q.name ? q.name.replace(/\s+USD$/, '') : q.name, // "Bitcoin USD" → "Bitcoin"
    };
  }
  return out;
}
