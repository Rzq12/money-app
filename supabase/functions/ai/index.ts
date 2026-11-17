// AI gateway between the app and an OpenAI-compatible provider; prompts and images are never logged.
// Secrets: AI_BASE_URL, AI_API_KEY, AI_MODEL, optional AI_VISION_MODEL and AI_DAILY_LIMIT (100).

type Env = Record<string, string | undefined>;
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Json) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, error: string, extra: Json = {}) => reply(status, { ok: false, error, ...extra });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: unknown): s is string => typeof s === 'string' && DATE.test(s) && !Number.isNaN(Date.parse(s));
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Amounts may come back as text written either way: "25.000", "25.000,50", "25,000.50", "Rp 25.000".
const toNumber = (v: string) => {
  const s = v.replace(/rp\.?|idr|\s/gi, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
  return Number(s.replace(',', '.'));
};
const money = (v: unknown) => { const n = typeof v === 'string' ? toNumber(v) : Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
const pick = (id: unknown, list: Json[]) => (typeof id === 'string' && list.some((x) => x.id === id) ? id : null);
const shiftDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const listOf = (v: unknown, max: number): Json[] => (Array.isArray(v) ? v.slice(0, max) : []);

class GatewayError extends Error { constructor(public code: string, public status = 502) { super(code); } }

export async function handle(req: Request, env: Env, http: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method');
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer \S+/.test(auth)) return fail(401, 'unauthorized');
  const supa = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = env.SUPABASE_ANON_KEY || '';
  const db = async (path: string, init: RequestInit = {}) => {
    const res = await http(supa + path, { ...init, headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    const text = await res.text();
    if (!res.ok) throw new GatewayError(res.status === 401 ? 'unauthorized' : 'db', res.status === 401 ? 401 : 502);
    return text ? JSON.parse(text) : null;
  };
  try {
    await db('/auth/v1/user');
  } catch { return fail(401, 'unauthorized'); }
  if (!env.AI_BASE_URL || !env.AI_API_KEY || !env.AI_MODEL) return fail(503, 'not_configured');

  let body: Json;
  try { body = await req.json(); } catch { return fail(400, 'bad_request'); }
  const task = body?.task; const p = body?.payload || {};
  if (!['parse', 'ask', 'receipt', 'categorize', 'summary'].includes(task)) return fail(400, 'bad_request');

  const limit = Math.max(1, Number(env.AI_DAILY_LIMIT) || 100);
  let take: Json;
  try { take = await db('/rest/v1/rpc/ai_take', { method: 'POST', body: JSON.stringify({ p_limit: limit }) }); } catch (e) { return fail(e instanceof GatewayError ? e.status : 502, e instanceof GatewayError ? e.code : 'db'); }
  if (!take?.ok) return fail(429, 'limit', { remaining: 0 });
  const remaining = Math.max(0, limit - Number(take.count));

  // One chat completion returning a JSON object; a malformed answer gets one retry.
  const ask = async (system: string, user: Json, vision = false): Promise<Json> => {
    const model = vision ? env.AI_VISION_MODEL || env.AI_MODEL : env.AI_MODEL;
    const messages = [{ role: 'system', content: `${system}\nReply with one JSON object only.` }, { role: 'user', content: user }];
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await http(`${env.AI_BASE_URL!.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST', signal: AbortSignal.timeout(30_000),
          headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature: 0.1, response_format: { type: 'json_object' } }),
        });
      } catch (e) { throw new GatewayError((e as Error)?.name === 'TimeoutError' ? 'timeout' : 'provider', 504); }
      if (!res.ok) throw new GatewayError(res.status === 429 ? 'provider_busy' : 'provider', 502);
      const data = await res.json().catch(() => null);
      const text = String(data?.choices?.[0]?.message?.content || '').replace(/^```(json)?\s*|\s*```$/g, '');
      try { const out = JSON.parse(text); if (out && typeof out === 'object') return out; } catch { /* retried below */ }
    }
    throw new GatewayError('bad_output', 502);
  };
  const lang = p.lang === 'en' ? 'English' : 'Indonesian';
  const cats = listOf(p.categories, 120).map((c: Json) => ({ id: str(c.id, 60), name: str(c.name, 40), type: c.type === 'income' ? 'income' : 'expense' })).filter((c) => c.id);
  const accounts = listOf(p.accounts, 60).map((a: Json) => ({ id: str(a.id, 60), name: str(a.name, 40) })).filter((a) => a.id);
  const today = isDate(p.today) ? p.today : new Date().toISOString().slice(0, 10);

  try {
    if (task === 'parse') {
      const out = await ask(
        `You turn a person's message about money into transactions for a finance app in Indonesia. Today is ${today}.
Amounts: "25rb"/"25 ribu"/"25k" = 25000, "5jt"/"5 juta" = 5000000. "kemarin" = yesterday.
Use only the category and account ids given. If the amount is missing or the message is unclear, set "question" (in ${lang}) and return no transactions.
Shape: {"transactions":[{"type":"expense|income|transfer","amount":number,"category_id":string|null,"account_id":string|null,"to_account_id":string|null,"date":"YYYY-MM-DD","note":string,"tags":[string]}],"question":string|null}`,
        JSON.stringify({ message: str(p.text, 400), categories: cats, accounts }),
      );
      const list = listOf(out.transactions, 10).map((x: Json) => {
        const type = ['expense', 'income', 'transfer'].includes(x?.type) ? x.type : 'expense';
        const pool = cats.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
        return {
          type, amount: money(x?.amount),
          categoryId: type === 'transfer' ? null : pick(x?.category_id, pool),
          accountId: pick(x?.account_id, accounts), toAccountId: type === 'transfer' ? pick(x?.to_account_id, accounts) : null,
          date: isDate(x?.date) ? x.date : today, note: str(x?.note), tags: listOf(x?.tags, 6).map((t: Json) => str(t, 24)).filter(Boolean),
        };
      }).filter((x) => x.amount);
      return reply(200, { ok: true, remaining, result: { transactions: list, question: list.length ? null : str(out.question, 200) || null } });
    }

    if (task === 'ask') {
      const plan = await ask(
        `Today is ${today}. Decide which date range answers the person's question about their own spending or income.
If it needs anything other than totals per category, per day or budgets (for example one specific purchase), set "answerable": false.
Shape: {"answerable":boolean,"from":"YYYY-MM-DD","to":"YYYY-MM-DD","compare_previous":boolean}`,
        str(p.text, 400),
      );
      if (!plan.answerable || !isDate(plan.from) || !isDate(plan.to) || plan.from > plan.to) return reply(200, { ok: true, remaining, result: { unsupported: true } });
      const to = plan.to > today ? today : plan.to;
      const from = Date.parse(to) - Date.parse(plan.from) > 366 * 86400000 ? shiftDays(to, -366) : plan.from;
      const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
      const brief = (t: Json) => ({ from: t.from, to: t.to, currency: t.currency, income: t.income, expense: t.expense, count: t.count, by_category: listOf(t.by_category, 40).map((c: Json) => ({ type: c.type, name: c.name, total: c.total, count: c.count })) });
      const now = brief(await db('/rest/v1/rpc/totals', { method: 'POST', body: JSON.stringify({ p_from: from, p_to: to }) }));
      const prev = plan.compare_previous ? brief(await db('/rest/v1/rpc/totals', { method: 'POST', body: JSON.stringify({ p_from: shiftDays(from, -days), p_to: shiftDays(from, -1) }) })) : null;
      const budgets = listOf(await db('/rest/v1/rpc/budget_usage', { method: 'POST', body: '{}' }), 30).map((b: Json) => ({ name: b.name || 'all', period: b.period, limit: b.limit, spent: b.spent }));
      const out = await ask(
        `Answer the person's question in ${lang} in at most three short sentences, using only these totals. Say which dates the answer covers. Format money like the currency given.
Shape: {"answer":string}`,
        JSON.stringify({ question: str(p.text, 400), period: now, previous_period: prev, budgets }),
      );
      return reply(200, { ok: true, remaining, result: { answer: str(out.answer, 600), from, to } });
    }

    if (task === 'receipt') {
      const image = typeof p.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p.image) && p.image.length < 4_000_000 ? p.image : null;
      if (!image) return fail(400, 'bad_request');
      const out = await ask(
        `Read this shop receipt. Use the printed grand total, not a subtotal. Leave a field null when it is not printed.
Pick the best expense category id from the list, or null.
Shape: {"readable":boolean,"merchant":string|null,"date":"YYYY-MM-DD"|null,"total":number|null,"tax":number|null,"service":number|null,"items":[{"name":string,"price":number}],"category_id":string|null}`,
        [{ type: 'text', text: JSON.stringify({ categories: cats.filter((c) => c.type === 'expense') }) }, { type: 'image_url', image_url: { url: image } }],
        true,
      );
      if (out.readable === false || !money(out.total)) return reply(200, { ok: true, remaining, result: { readable: false } });
      return reply(200, {
        ok: true, remaining, result: {
          readable: true, merchant: str(out.merchant, 60) || null, date: isDate(out.date) ? out.date : null, total: money(out.total),
          tax: money(out.tax), service: money(out.service), categoryId: pick(out.category_id, cats.filter((c) => c.type === 'expense')),
          items: listOf(out.items, 60).map((it: Json) => ({ name: str(it?.name, 40), price: Number(it?.price) })).filter((it) => it.name && Number.isFinite(it.price) && it.price !== 0),
        },
      });
    }

    if (task === 'categorize') {
      const notes = listOf(p.notes, 50).map((n: Json) => ({ note: str(n?.note, 120), type: n?.type === 'income' ? 'income' : 'expense' }));
      if (!notes.length) return reply(200, { ok: true, remaining, result: { ids: [] } });
      const out = await ask(
        `For each transaction note, choose the best category id of the same type from the list, or null when none fits.
Shape: {"ids":[string|null]} with one entry per note, in order.`,
        JSON.stringify({ notes, categories: cats }),
      );
      const ids = notes.map((n, i) => pick(listOf(out.ids, 50)[i], cats.filter((c) => c.type === n.type)));
      return reply(200, { ok: true, remaining, result: { ids } });
    }

    // summary
    const month = typeof p.month === 'string' && /^\d{4}-\d{2}$/.test(p.month) ? p.month : null;
    if (!month) return fail(400, 'bad_request');
    const first = `${month}-01`;
    const last = shiftDays(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1)).toISOString().slice(0, 10), -1);
    const prevFirst = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 2, 1)).toISOString().slice(0, 10);
    const now = await db('/rest/v1/rpc/totals', { method: 'POST', body: JSON.stringify({ p_from: first, p_to: last }) });
    if (!Number(now?.count)) return reply(200, { ok: true, remaining, result: { empty: true } });
    const prev = await db('/rest/v1/rpc/totals', { method: 'POST', body: JSON.stringify({ p_from: prevFirst, p_to: shiftDays(first, -1) }) });
    const at = last < today ? `${last}T12:00:00Z` : new Date().toISOString();
    const budgets = await db('/rest/v1/rpc/budget_usage', { method: 'POST', body: JSON.stringify({ p_at: at }) });
    const strip = (t: Json) => ({ income: t.income, expense: t.expense, count: t.count, currency: t.currency, by_category: listOf(t.by_category, 40).map((c: Json) => ({ type: c.type, name: c.name, total: c.total })) });
    const out = await ask(
      `Write a short monthly money summary in ${lang} for the person, 4 to 6 sentences, plain text, no headings or lists.
Cover where the money went, change from the previous month (skip it when the previous month has no transactions), budgets close to or over their limit, and anything unusual. Do not give investment or debt advice.
Shape: {"text":string}`,
      JSON.stringify({ month, this_month: strip(now), previous_month: strip(prev), budgets: listOf(budgets, 30).map((b: Json) => ({ name: b.name || 'all', period: b.period, limit: b.limit, spent: b.spent })) }),
    );
    const text = str(out.text, 1500);
    if (!text) throw new GatewayError('bad_output');
    const saved = await db('/rest/v1/ai_summaries?on_conflict=user_id,month', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify([{ month, text, generated_at: new Date().toISOString() }]),
    });
    return reply(200, { ok: true, remaining, result: { text, generatedAt: saved?.[0]?.generated_at || new Date().toISOString() } });
  } catch (e) {
    if (e instanceof GatewayError) return fail(e.status, e.code, { remaining });
    return fail(500, 'internal', { remaining });
  }
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handle(req, D.env.toObject()));
