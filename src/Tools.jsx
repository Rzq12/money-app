// Portfolio, split bill, the chat logger and the two calculators.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { store, useStore, live, nameOf, uid, formatMoney, CHAT_KEY } from './store.js';
import { useT, useMoney, Icon, Sheet, Segmented, PageHead, Empty, AddBtn, Progress, confirmAsk, Count, Flash } from './ui.jsx';
import { splitTotals, kpr, pph21, parseQuick, toDateInput, fromDateInput, compressImage } from './logic.js';
import { callAI, useAi, context, aiReason } from './ai.js';
import { num, Field, AmountInput, EditActions } from './Money.jsx';
import { LIVE_KINDS, GOLD, cleanSymbol, yahooSymbol, quoteHoldings, searchSymbols } from './quotes.js';

const pctText = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

// ---------- portfolio: stocks, crypto and world gold follow the market; funds are typed in by hand ----------
const KINDS = ['saham', 'saham_luar', 'kripto', 'reksadana', 'emas'];
const REFRESH_MS = 60_000; // while the page is open and visible
const SAVE_EVERY_MS = 5 * 60_000; // live prices are written to the synced record at most this often
const cents = (v) => Math.round(v * 100) / 100;
const WHOLE = { whole: true }; // portfolio amounts without cents, so totals fit on a phone
const isLive = (type, gold) => (type === 'emas' ? gold : LIVE_KINDS.includes(type));

// Code field with suggestions from the market, so the stored code is exactly the exchange's.
// Typing a code or company name lists matches; picking one fills the code (and the name if empty).
function SymbolPicker({ type, value, onType, onPick, hint, autoFocus }) {
  const t = useT();
  const [list, setList] = useState([]); const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); const [status, setStatus] = useState('idle'); // idle | loading | empty | failed
  const inputRef = useRef(null); const timer = useRef(null); const seq = useRef(0);
  const id = `sym-${type}`;
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { seq.current++; setList([]); setOpen(false); setStatus('idle'); }, [type]);
  function search(text) {
    clearTimeout(timer.current);
    const n = ++seq.current;
    if (text.trim().length < 2) { setList([]); setOpen(false); setStatus('idle'); return; }
    setStatus('loading'); setOpen(true);
    timer.current = setTimeout(async () => {
      try {
        const found = await searchSymbols(type, text);
        if (n !== seq.current) return;
        setList(found); setActive(found.length ? 0 : -1); setStatus(found.length ? 'idle' : 'empty');
      } catch { if (n === seq.current) { setList([]); setStatus('failed'); } }
    }, 250);
  }
  function pick(x) { seq.current++; onPick(x); setOpen(false); setList([]); setStatus('idle'); }
  const keys = useRef(null);
  keys.current = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length);
    } else if (e.key === 'Enter' && list[active]) { e.preventDefault(); pick(list[active]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } // close the list, not the sheet
  };
  // A native listener: it runs before the sheet's own Escape handler further up the tree.
  useEffect(() => {
    const el = inputRef.current; const k = (e) => keys.current(e);
    el.addEventListener('keydown', k);
    return () => el.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="field">
      <label htmlFor={id}>{t.pfSymbol}</label>
      <div className="combo">
        <input id={id} ref={inputRef} value={value} maxLength={40} autoFocus={autoFocus}
          autoComplete="off" autoCorrect="off" spellCheck={false}
          role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && list[active] ? `${id}-${active}` : undefined}
          onChange={(e) => { onType(e.target.value); search(e.target.value); }}
          onFocus={() => { if (list.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {open && (
          <ul className="combo-list" role="listbox" id={`${id}-list`} aria-label={t.pfSymbol}>
            {list.map((x, i) => (
              <li key={x.symbol} id={`${id}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
                onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(x)}>
                <b>{x.symbol}</b><span>{x.name}</span>{x.exchange && <small>{x.exchange}</small>}
              </li>
            ))}
            {status === 'loading' && !list.length && <li className="combo-msg">{t.pfSearching}</li>}
            {status === 'empty' && <li className="combo-msg">{t.pfSearchNone}</li>}
            {status === 'failed' && <li className="combo-msg">{t.pfSearchFailed}</li>}
          </ul>
        )}
      </div>
      <small className="hint">{hint}</small>
    </div>
  );
}

function HoldingEditor({ item, onClose }) {
  const t = useT(); const { settings } = useStore();
  const [type, setType] = useState(item?.type || 'saham');
  const [symbol, setSymbol] = useState(item?.symbol && item.symbol !== GOLD ? item.symbol : (item?.type === 'saham' && /^[A-Za-z]{4}$/.test(item?.name || '') ? item.name.toUpperCase() : ''));
  const [gold, setGold] = useState(item ? item.symbol === GOLD : true);
  const [name, setName] = useState(item?.name || '');
  const [units, setUnits] = useState(item ? String(item.units) : '');
  const [buy, setBuy] = useState(item ? String(item.buyPrice) : '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const autoName = useRef(''); // name filled from the last pick, replaced when another listing is picked
  function pickListing(x) {
    setSymbol(x.symbol); setErr('');
    if (x.name && (!name.trim() || name === autoName.current)) { setName(x.name); autoName.current = x.name; }
  }
  const auto = isLive(type, gold);
  const coded = auto && type !== 'emas'; // needs a market code typed in
  async function save() {
    if (busy) return;
    const sym = type === 'emas' ? (gold ? GOLD : '') : coded ? cleanSymbol(type, symbol) : '';
    if (coded && !sym) return setErr(t.pfNeedSymbol);
    if (!auto && !name.trim()) return setErr(t.needName);
    if (!(num(units) > 0) || !(num(buy) > 0)) return setErr(t.pfNeedNumbers);
    let q = null;
    if (auto) {
      setBusy(true); setErr('');
      try {
        q = (await quoteHoldings([{ id: 'new', type, symbol: sym }], settings.currency)).new;
        if (!q) { setBusy(false); return setErr(t.pfNoSymbol.replace('{code}', sym)); }
      } catch { q = null; /* offline: keep the code, the price follows on the next refresh */ }
      setBusy(false);
    }
    store.put({
      id: item?.id || uid(), kind: 'holding', type, symbol: sym || null,
      name: name.trim() || (coded ? q?.name || sym : t.pfKinds[type]),
      units: num(units), buyPrice: num(buy),
      price: q ? cents(q.price) : auto ? item?.price || num(buy) : num(price) || num(buy),
      priceAt: Date.now(), order: item?.order ?? Date.now(),
    });
    onClose();
  }
  async function del() { if (await confirmAsk(`${t.delete}?`, { danger: true, okLabel: t.delete })) { store.remove(item.id); onClose(); } }
  return (
    <Sheet open onClose={onClose} title={item ? t.pfEdit : t.pfNew} full actions={<EditActions onSave={save} onDelete={item && del} />}>
      <div className="form">
        <Segmented label={t.type} value={type} onChange={(v) => {
          setType(v); setErr('');
          // A code means nothing in another market: start over, keeping a name the user typed.
          if (v !== type) { setSymbol(''); if (name === autoName.current) { setName(''); autoName.current = ''; } }
        }} options={KINDS.map((k) => ({ value: k, label: t.pfKinds[k] }))} />
        {coded && <SymbolPicker key={type} type={type} value={symbol} onType={setSymbol} onPick={pickListing} hint={t.pfSymbolHint[type]} autoFocus={!item} />}
        {type === 'emas' && (
          <label className="field-row">
            <span><b>{t.pfGold}</b><small className="hint">{t.pfGoldHint}</small></span>
            <input type="checkbox" className="switch" checked={gold} onChange={(e) => setGold(e.target.checked)} />
          </label>
        )}
        <Field label={auto ? t.pfNameOptional : t.pfName} hint={coded ? t.pfNameAuto : t.pfNameHint[type]}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus={!item && !coded} /></Field>
        <Field label={t.pfUnits[type]}><AmountInput value={units} onChange={setUnits} /></Field>
        <Field label={t.pfBuy.replace('{cur}', settings.currency)}><AmountInput value={buy} onChange={setBuy} /></Field>
        {!auto && <Field label={t.pfPrice} hint={t.pfPriceHint}><AmountInput value={price} onChange={setPrice} placeholder={buy || '0'} /></Field>}
        {auto && <p className="hint">{t.pfAutoPrice}</p>}
        {busy && <p className="hint" role="status">{t.pfChecking}</p>}
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}

// Market prices for the holdings that follow one: fetched on open, every minute while the page
// is visible, and on demand. The synced record keeps the last price so offline totals still work.
function useLivePrices(list, main) {
  const [quotes, setQuotes] = useState({});
  const [state, setState] = useState({ busy: false, at: null, failed: false });
  const listRef = useRef(list); listRef.current = list;
  const key = list.map((h) => `${h.id}:${yahooSymbol(h) || ''}`).join('|');
  const tracked = list.some((h) => yahooSymbol(h));
  const refresh = useCallback(async (force) => {
    const hs = listRef.current.filter((h) => yahooSymbol(h));
    if (!hs.length) return;
    setState((s) => ({ ...s, busy: true }));
    try {
      const q = await quoteHoldings(hs, main);
      setQuotes(q); setState({ busy: false, at: Date.now(), failed: false });
      const now = Date.now();
      const save = hs.filter((h) => q[h.id] && cents(q[h.id].price) !== h.price && (force || now - (h.priceAt || 0) >= SAVE_EVERY_MS))
        .map((h) => ({ id: h.id, price: cents(q[h.id].price), priceAt: now, ...(h.symbol ? {} : { symbol: cleanSymbol('saham', h.name) }) }));
      if (save.length) store.putMany(save, { keepTime: true });
    } catch { setState((s) => ({ ...s, busy: false, failed: true })); }
  }, [main]);
  useEffect(() => {
    if (!tracked) return undefined;
    refresh(false);
    const tick = () => { if (!document.hidden) refresh(false); };
    const id = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [key, tracked, refresh]);
  return { quotes, tracked, ...state, refresh: () => refresh(true) };
}

export function Portfolio() {
  const t = useT(); const money = useMoney(); const { records, settings } = useStore();
  const lang = settings.lang; const loc = lang === 'id' ? 'id-ID' : 'en-US';
  const [edit, setEdit] = useState(null);
  const list = live(records, 'holding');
  const lp = useLivePrices(list, settings.currency);
  const priceOf = (h) => lp.quotes[h.id]?.price ?? h.price;
  const cost = list.reduce((a, h) => a + h.units * h.buyPrice, 0);
  const value = list.reduce((a, h) => a + h.units * priceOf(h), 0);
  const pl = value - cost;
  // The three stat boxes are a third of a phone wide: from 10 million on, "Rp 42,2 jt" instead of "Rp 42.156.913".
  const statMoney = (n) => money(n, Math.abs(n) >= 1e7 ? { compact: true } : WHOLE);
  const time = (ms) => new Date(ms).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="page">
      <PageHead title={t.portfolio} sub={t.pfSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="trend" title={t.pfEmpty} hint={t.pfEmptyHint} /> : (
        <>
          <div className="stats card">
            <div><small>{t.pfValue}</small><b title={money(value, WHOLE)}>{statMoney(value)}</b></div>
            <div><small>{t.pfCost}</small><b title={money(cost, WHOLE)}>{statMoney(cost)}</b></div>
            <div><small>{t.pfPl}</small><b className={pl < 0 ? 'neg' : ''} title={money(pl, WHOLE)}>{pl >= 0 ? '+' : ''}{statMoney(pl)}{cost > 0 ? ` (${pctText((pl / cost) * 100)})` : ''}</b></div>
          </div>
          {lp.tracked && (
            <div className="live-bar" role="status">
              <span className={`live-dot ${lp.failed ? 'off' : lp.at ? 'on' : ''}`} aria-hidden="true" />
              <span className="hint grow">{lp.failed ? t.pfLiveFailed : lp.at ? t.pfLiveAt.replace('{time}', time(lp.at)) : t.pfLiveLoading}</span>
              <button className="text-btn" onClick={lp.refresh} disabled={lp.busy}><Icon name="repeat" size={14} />{lp.busy ? t.pfLiveLoading : t.pfRefresh}</button>
            </div>
          )}
          {KINDS.map((k) => {
            const items = list.filter((h) => h.type === k);
            if (!items.length) return null;
            return (
              <section key={k}>
                <h2 className="sec-title">{t.pfKinds[k]}</h2>
                <div className="card">
                  {items.map((h) => {
                    const q = lp.quotes[h.id]; const p = priceOf(h);
                    const v = h.units * p; const d = v - h.units * h.buyPrice;
                    // Per-unit price in the market's own currency (US$352,78) when it differs from the main one.
                    const unitText = q && q.currency !== settings.currency ? formatMoney(q.native, q.currency, lang) : money(p, p >= 100 ? WHOLE : undefined);
                    const dayText = q?.changePct != null ? ` · ${pctText(q.changePct)} ${t.pfToday}` : '';
                    return (
                      <button key={h.id} className="bill" onClick={() => setEdit(h)}>
                        <span className="bill-main"><span className="bill-title">{h.name}{h.symbol && h.symbol !== GOLD && h.symbol !== h.name ? ` · ${h.symbol}` : ''}</span>
                          <span className="bill-sub">{h.units.toLocaleString(loc, { maximumFractionDigits: 8 })} × {unitText}{dayText}</span></span>
                        <span className="bill-end"><Flash value={p} className="bill-amt">{money(v, WHOLE)}</Flash>
                          <span className={`bill-sub ${d < 0 ? 'neg' : ''}`}>{d >= 0 ? '+' : ''}{money(d, WHOLE)} ({pctText(h.buyPrice ? (d / (h.units * h.buyPrice)) * 100 : 0)})</span></span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
      {edit && <HoldingEditor item={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------- split bill ----------
function SplitEditor({ item, onClose }) {
  const t = useT(); const money = useMoney();
  const [s, setS] = useState(() => item || { title: '', people: [t.splitMe], items: [], taxPct: '', servicePct: '', paid: [] });
  const [person, setPerson] = useState(''); const [iname, setIname] = useState(''); const [iprice, setIprice] = useState('');
  const [err, setErr] = useState(''); const [reading, setReading] = useState(false);
  const receiptRef = useRef(null);
  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  async function readReceipt(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setReading(true);
    try {
      const r = await callAI('receipt', { image: await compressImage(f), ...context() });
      if (!r.readable || !r.items.length) { setErr(t.receiptUnreadable); return; }
      const sub = r.items.reduce((a, it) => a + it.price, 0);
      const service = r.service && sub ? Math.round((r.service / sub) * 1000) / 10 : null;
      const tax = r.tax && sub ? Math.round((r.tax / (sub + (r.service || 0))) * 1000) / 10 : null;
      setS((x) => ({ ...x, title: x.title || r.merchant || '', items: [...x.items, ...r.items.map((it) => ({ name: it.name, price: it.price, who: [] }))],
        ...(service ? { servicePct: String(service) } : {}), ...(tax ? { taxPct: String(tax) } : {}) }));
    } catch (er) { setErr(aiReason(t, er)); } finally { setReading(false); }
  }
  const totals = splitTotals(s);
  const addPerson = () => { if (person.trim()) { set({ people: [...s.people, person.trim()] }); setPerson(''); } };
  const addItem = () => { if (iname.trim() && num(iprice) > 0) { set({ items: [...s.items, { name: iname.trim(), price: num(iprice), who: [] }] }); setIname(''); setIprice(''); } };
  const removePerson = (i) => set({
    people: s.people.filter((_, j) => j !== i), paid: (s.paid || []).filter((_, j) => j !== i),
    items: s.items.map((it) => ({ ...it, who: (it.who || []).filter((j) => j !== i).map((j) => (j > i ? j - 1 : j)) })),
  });
  // An empty list means everyone shares the item, so the first tap on a lit chip takes that person out.
  // The last person cannot be taken out; when everyone is back in, the list returns to empty.
  const toggleWho = (k, i) => set({ items: s.items.map((it, j) => {
    if (j !== k) return it;
    const all = s.people.map((_, x) => x);
    const cur = (it.who || []).length ? it.who : all;
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b);
    if (!next.length) return it;
    return { ...it, who: next.length === all.length ? [] : next };
  }) });
  function save() {
    if (!s.title.trim()) return setErr(t.needName);
    if (!s.items.length) return setErr(t.splitNeedItem);
    store.put({ id: item?.id || uid(), kind: 'split', title: s.title.trim(), people: s.people, items: s.items, taxPct: num(s.taxPct), servicePct: num(s.servicePct), paid: s.paid || [], time: item?.time || Date.now() });
    onClose();
  }
  async function del() { if (await confirmAsk(`${t.delete}?`, { danger: true, okLabel: t.delete })) { store.remove(item.id); onClose(); } }
  return (
    <Sheet open onClose={onClose} title={item ? t.splitEdit : t.splitNew} full actions={<EditActions onSave={save} onDelete={item && del} />}>
      <div className="form">
        <Field label={t.splitTitle}><input value={s.title} onChange={(e) => set({ title: e.target.value })} maxLength={40} autoFocus={!item} /></Field>

        <div className="field"><span>{t.splitPeople}</span>
          <div className="chips wrap">
            {s.people.map((p, i) => (
              <span key={i} className="chip">{p}{s.people.length > 1 && <button className="chip-x" aria-label={`${t.delete} ${p}`} onClick={() => removePerson(i)}><Icon name="close" size={12} /></button>}</span>
            ))}
          </div>
          <div className="inline-add">
            <input value={person} placeholder={t.splitPersonPh} maxLength={20} onChange={(e) => setPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} />
            <button className="btn" onClick={addPerson}>{t.add}</button>
          </div>
        </div>

        <div className="field"><span>{t.splitItems}</span>
          {s.items.map((it, k) => (
            <div key={k} className="card pad-card tight">
              <div className="rank-top"><span>{it.name}</span><b>{money(it.price)}</b></div>
              <div className="chips wrap" role="group" aria-label={`${t.splitWho} ${it.name}`}>
                {s.people.map((p, i) => {
                  const on = !(it.who || []).length || it.who.includes(i);
                  return <button key={i} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleWho(k, i)}>{p}</button>;
                })}
                <button className="chip-x end" aria-label={`${t.delete} ${it.name}`} onClick={() => set({ items: s.items.filter((_, j) => j !== k) })}><Icon name="trash" size={16} /></button>
              </div>
            </div>
          ))}
          <div className="inline-add">
            <input value={iname} placeholder={t.splitItemPh} maxLength={30} onChange={(e) => setIname(e.target.value)} />
            <input className="narrow" inputMode="decimal" value={iprice} placeholder={t.splitPricePh} onChange={(e) => setIprice(e.target.value.replace(/[^0-9.,]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
            <button className="btn" onClick={addItem}>{t.add}</button>
          </div>
          <small className="hint">{t.splitWhoHint}</small>
          <div className="btn-row"><button className="btn sm" disabled={reading} onClick={() => receiptRef.current?.click()}><Icon name="receipt" size={14} />{reading ? t.receiptReading : t.receiptRead}</button></div>
          <input ref={receiptRef} type="file" accept="image/*" hidden onChange={readReceipt} />
        </div>

        <div className="two">
          <Field label={t.splitService}><AmountInput value={s.servicePct} onChange={(v) => set({ servicePct: v })} /></Field>
          <Field label={t.splitTax}><AmountInput value={s.taxPct} onChange={(v) => set({ taxPct: v })} /></Field>
        </div>

        <div className="card">
          {s.people.map((p, i) => (
            <label key={i} className="row">
              <span className="grow">{p}</span><b className="bill-amt">{money(totals.per[i] || 0)}</b>
              <input type="checkbox" className="switch" aria-label={`${p}: ${t.paidOff}`} checked={!!(s.paid || [])[i]}
                onChange={(e) => { const paid = s.people.map((_, j) => (j === i ? e.target.checked : !!(s.paid || [])[j])); set({ paid }); }} />
            </label>
          ))}
          <div className="row static sum"><span className="grow">{t.subtotal} {money(totals.subtotal)} · {t.splitService} {money(totals.service)} · {t.splitTax} {money(totals.tax)}</span><b className="bill-amt"><Count value={totals.total} format={money} /></b></div>
        </div>
        <small className="hint">{t.splitPaidHint}</small>
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}
export function Split() {
  const t = useT(); const money = useMoney(); const { records } = useStore();
  const [edit, setEdit] = useState(null);
  const list = live(records, 'split').sort((a, b) => b.time - a.time);
  return (
    <div className="page">
      <PageHead title={t.split} sub={t.splitSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="receipt" title={t.splitEmpty} hint={t.splitEmptyHint} /> : (
        <div className="card">
          {list.map((s) => {
            const tot = splitTotals(s); const paid = s.people.filter((_, i) => (s.paid || [])[i]).length;
            return (
              <button key={s.id} className="row tall" onClick={() => setEdit(s)}>
                <span className="rank-main">
                  <span className="rank-top"><span>{s.title}</span><b><Count value={tot.total} format={money} /></b></span>
                  <Progress value={paid} max={s.people.length} />
                  <span className="rank-top sub"><small>{s.people.join(', ')}</small><small>{paid === s.people.length ? t.paidOff : `${paid}/${s.people.length} ${t.paidOff.toLowerCase()}`}</small></span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {edit && <SplitEditor item={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------- chat: AI understands sentences and questions; keyword rules when AI is unavailable ----------
const QUESTION = /\?\s*$|^(berapa|apa|kapan|mana|bagaimana|gimana|apakah|bandingkan|tampilkan|how|what|when|which|compare|show)\b/i;

export function Chat({ onOpenBill }) {
  const t = useT(); const { records, settings } = useStore(); const lang = settings.lang;
  const ai = useAi();
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch { return []; } });
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-60))); } catch { /* storage full: history is a convenience */ } end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  const add = (m) => setMsgs((list) => [...list, m]);
  const lastAcc = () => (records[settings.lastAccountId] && !records[settings.lastAccountId].deleted ? settings.lastAccountId : live(records, 'account')[0]?.id);

  const proposal = (x) => ({ ...x, id: uid(), accountId: x.accountId || lastAcc(), check: !x.accountId, state: 'open' });
  const asBill = (p) => ({
    id: p.id, kind: 'bill', type: p.type, amount: p.amount, note: (p.note || '').slice(0, 120), tags: p.tags || [],
    time: p.date === toDateInput(Date.now()) ? Date.now() : fromDateInput(p.date, 12), bookId: settings.bookId, accountId: p.accountId,
    toAccountId: p.type === 'transfer' ? p.toAccountId : null, categoryId: p.type === 'transfer' ? null : p.categoryId, memberId: 'mem-me', createdAt: Date.now(),
  });
  const valid = (p) => p.amount > 0 && records[p.accountId] && !records[p.accountId].deleted
    && (p.type === 'transfer' ? records[p.toAccountId] && p.toAccountId !== p.accountId : records[p.categoryId] && !records[p.categoryId].deleted);
  const setState = (mi, ids, state) => setMsgs((list) => list.map((m, i) => (i !== mi ? m : { ...m, proposals: m.proposals.map((p) => (ids.includes(p.id) ? { ...p, state } : p)) })));
  const save = (mi, list) => { const ok = list.filter(valid); if (ok.length) store.putMany(ok.map(asBill)); setState(mi, ok.map((p) => p.id), 'saved'); };

  async function send(e) {
    e.preventDefault();
    const said = text.trim();
    if (!said || busy) return;
    setText(''); add({ me: said }); setBusy(true);
    const isQuestion = QUESTION.test(said);
    try {
      if (isQuestion) {
        const r = await callAI('ask', { text: said, lang, today: toDateInput(Date.now()) });
        add(r.unsupported ? { bot: t.chatCannot } : { bot: r.answer, ai: true });
      } else {
        const r = await callAI('parse', { text: said, ...context() });
        add(r.transactions.length ? { proposals: r.transactions.map(proposal), ai: true } : { bot: r.question || t.chatNoAmount, ai: !!r.question });
      }
    } catch (err) {
      const why = aiReason(t, err);
      if (isQuestion) add({ bot: `${t.chatNeedsAi} ${why}` });
      else {
        const p = parseQuick(said, records);
        add(p && p.category
          ? { proposals: [proposal({ type: p.type, amount: p.amount, categoryId: p.category.id, accountId: null, toAccountId: null, date: toDateInput(Date.now()), note: p.note, tags: [] })], note: `${t.chatKeywords} ${why}` }
          : { bot: t.chatNoAmount, note: why });
      }
    }
    setBusy(false);
  }

  const line = (p) => [t[p.type], formatMoney(p.amount, records[p.accountId]?.currency || settings.currency, lang),
    p.type === 'transfer' ? `${nameOf(records[p.accountId], lang)} → ${nameOf(records[p.toAccountId], lang)}` : `${nameOf(records[p.categoryId], lang)} · ${nameOf(records[p.accountId], lang)}`,
    new Date(fromDateInput(p.date)).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' })].join(' · ');

  return (
    <div className="page chat">
      <PageHead title={t.chat} sub={ai.off ? t.chatSubOff : t.chatSub} action={msgs.length > 0 && <button className="btn sm" onClick={() => setMsgs([])}>{t.chatClear}</button>} />
      <div className="chat-log" aria-live="polite">
        <div className="bubble bot">{t.chatHello}</div>
        {msgs.map((m, mi) => {
          if (m.me) return <div key={mi} className="bubble me">{m.me}</div>;
          if (!m.proposals) return <div key={mi} className="bubble bot">{m.ai && <span className="ai-tag">{t.aiLabel}</span>}<span>{m.bot}</span>{m.note && <small className="hint">{m.note}</small>}</div>;
          const open = m.proposals.filter((p) => p.state === 'open' && !records[p.id]);
          return (
            <div key={mi} className="bubble bot wide">
              {m.ai && <span className="ai-tag">{t.aiLabel}</span>}
              {m.note && <small className="hint">{m.note}</small>}
              {m.proposals.map((p, pi) => {
                const saved = p.state === 'saved' || records[p.id];
                const gone = saved && (!records[p.id] || records[p.id].deleted);
                return (
                  <div key={p.id} className={`proposal ${p.state}`} style={{ '--i': pi }}>
                    <span>{line(p)}{p.note ? ` · ${p.note}` : ''}</span>
                    {p.check && !saved && <small className="hint">{t.chatCheckWallet}</small>}
                    {!valid(p) && p.state === 'open' && <small className="err">{t.chatFix}</small>}
                    <span className="btn-row">
                      {p.state === 'dismissed' ? <small className="hint">{t.chatDismissed}</small>
                        : gone ? <small className="hint">{t.chatUndone}</small>
                          : saved ? <><small className="ok-msg">{t.chatSaved}</small><button className="btn sm" onClick={() => store.remove(p.id)}>{t.chatUndo}</button></>
                            : <>
                              <button className="btn primary sm" disabled={!valid(p)} onClick={() => save(mi, [p])}>{t.save}</button>
                              <button className="btn sm" onClick={() => onOpenBill(asBill(p))}>{t.edit}</button>
                              <button className="btn sm" onClick={() => setState(mi, [p.id], 'dismissed')}>{t.chatDismiss}</button>
                            </>}
                    </span>
                  </div>
                );
              })}
              {open.length > 1 && <span className="btn-row"><button className="btn primary sm" onClick={() => save(mi, open)}>{t.chatSaveAll.replace('{n}', open.filter(valid).length)}</button></span>}
            </div>
          );
        })}
        {busy && <div className="bubble bot typing" role="status" aria-label={t.chatThinking}><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      <form className="chat-in" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.chatPh} aria-label={t.chat} maxLength={400} autoComplete="off" />
        <button className="btn primary" type="submit" aria-label={t.chatSend} disabled={!text.trim() || busy}><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}

// ---------- calculators ----------
// Rows of [label, amount, strong]; the amounts count to each new result as the inputs change (M29).
function Result({ rows, money }) {
  return <div className="card pad-card">{rows.map(([k, v, strong]) => <div key={k} className={`kv ${strong ? 'strong' : ''}`}><span>{k}</span><b><Count value={v} format={money} /></b></div>)}</div>;
}
export function Kpr() {
  const t = useT(); const money = useMoney();
  const [price, setPrice] = useState('500.000.000'); const [dp, setDp] = useState('20'); const [rate, setRate] = useState('7'); const [years, setYears] = useState('15');
  const r = kpr({ price: num(price), dpPct: num(dp), ratePct: num(rate), years: num(years) || 1 });
  return (
    <div className="page">
      <PageHead title={t.kpr} sub={t.kprSub} />
      <div className="calc">
        <div className="form flush">
          <Field label={t.kprPrice}><AmountInput value={price} onChange={setPrice} /></Field>
          <div className="two">
            <Field label={t.kprDp}><AmountInput value={dp} onChange={setDp} /></Field>
            <Field label={t.kprRate}><AmountInput value={rate} onChange={setRate} /></Field>
          </div>
          <Field label={t.kprYears}><AmountInput value={years} onChange={setYears} /></Field>
        </div>
        <div>
          <Result money={money} rows={[[t.kprPay, Math.round(r.pay), true], [t.kprLoan, r.loan], [t.kprDpAmt, r.dp], [t.kprInterest, Math.round(r.interest)], [t.kprTotal, Math.round(r.total)]]} />
          <p className="hint gut">{t.kprNote}</p>
        </div>
      </div>
      <h2 className="sec-title">{t.kprSchedule}</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>{t.month}</th><th>{t.kprPrin}</th><th>{t.kprInt}</th><th>{t.kprBal}</th></tr></thead>
          <tbody>{r.rows.map((x) => <tr key={x.k}><td>{x.k}</td><td>{money(Math.round(x.prin))}</td><td>{money(Math.round(x.int))}</td><td>{money(Math.round(x.bal))}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
export function Pph() {
  const t = useT(); const money = useMoney();
  const [gross, setGross] = useState('10.000.000'); const [bonus, setBonus] = useState(''); const [pension, setPension] = useState('');
  const [married, setMarried] = useState(false); const [deps, setDeps] = useState('0');
  const r = pph21({ gross: num(gross), bonus: num(bonus), pension: num(pension), married, deps: Number(deps) });
  return (
    <div className="page">
      <PageHead title={t.pph} sub={t.pphSub} />
      <div className="calc">
        <div className="form flush">
          <Field label={t.pphGross}><AmountInput value={gross} onChange={setGross} /></Field>
          <Field label={t.pphBonus}><AmountInput value={bonus} onChange={setBonus} /></Field>
          <Field label={t.pphPension}><AmountInput value={pension} onChange={setPension} /></Field>
          <div className="two">
            <div className="field"><span>{t.pphStatus}</span>
              <Segmented label={t.pphStatus} value={married ? 'k' : 'tk'} onChange={(v) => setMarried(v === 'k')} options={[{ value: 'tk', label: t.pphSingle }, { value: 'k', label: t.pphMarried }]} /></div>
            <Field label={t.pphDeps}><select value={deps} onChange={(e) => setDeps(e.target.value)}>{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></Field>
          </div>
        </div>
        <div>
          <Result money={money} rows={[[t.pphMonthly, Math.round(r.monthly), true], [t.pphTakeHome, Math.round(r.takeHome)], [t.pphYearly, Math.round(r.tax)],
            [t.pphAnnual, r.annual], [t.pphJabatan, r.jabatan], [`PTKP (${married ? 'K' : 'TK'}/${deps})`, r.ptkp], ['PKP', r.pkp]]} />
          {r.parts.length > 0 && <Result money={money} rows={r.parts.map((p) => [`${p.rate * 100}% × ${money(p.slice)}`, Math.round(p.tax)])} />}
          <p className="hint gut">{t.pphNote}</p>
        </div>
      </div>
    </div>
  );
}
