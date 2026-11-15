// Portfolio, split bill, the chat logger and the two calculators.
import React, { useEffect, useRef, useState } from 'react';
import { store, useStore, live, nameOf, uid, formatMoney } from './store.js';
import { useT, useMoney, Icon, Sheet, Segmented, PageHead, Empty, AddBtn, Progress, confirmAsk } from './ui.jsx';
import { splitTotals, kpr, pph21, parseQuick } from './logic.js';
import { num, Field, AmountInput, EditActions } from './Money.jsx';

const pctText = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

// ---------- portfolio: prices are typed in by hand, there is no live quote feed ----------
const KINDS = ['saham', 'reksadana', 'emas'];
function HoldingEditor({ item, onClose }) {
  const t = useT();
  const [type, setType] = useState(item?.type || 'saham');
  const [name, setName] = useState(item?.name || '');
  const [units, setUnits] = useState(item ? String(item.units) : '');
  const [buy, setBuy] = useState(item ? String(item.buyPrice) : '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [err, setErr] = useState('');
  function save() {
    if (!name.trim()) return setErr(t.needName);
    if (!(num(units) > 0) || !(num(buy) > 0)) return setErr(t.pfNeedNumbers);
    store.put({ id: item?.id || uid(), kind: 'holding', type, name: name.trim(), units: num(units), buyPrice: num(buy), price: num(price) || num(buy), priceAt: Date.now(), order: item?.order ?? Date.now() });
    onClose();
  }
  async function del() { if (await confirmAsk(`${t.delete}?`, { danger: true, okLabel: t.delete })) { store.remove(item.id); onClose(); } }
  return (
    <Sheet open onClose={onClose} title={item ? t.pfEdit : t.pfNew} full actions={<EditActions onSave={save} onDelete={item && del} />}>
      <div className="form">
        <Segmented label={t.type} value={type} onChange={setType} options={KINDS.map((k) => ({ value: k, label: t.pfKinds[k] }))} />
        <Field label={t.pfName} hint={t.pfNameHint[type]}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus={!item} /></Field>
        <Field label={t.pfUnits[type]}><AmountInput value={units} onChange={setUnits} /></Field>
        <Field label={t.pfBuy}><AmountInput value={buy} onChange={setBuy} /></Field>
        <Field label={t.pfPrice} hint={t.pfPriceHint}><AmountInput value={price} onChange={setPrice} placeholder={buy || '0'} /></Field>
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}
export function Portfolio() {
  const t = useT(); const money = useMoney(); const { records } = useStore();
  const [edit, setEdit] = useState(null);
  const list = live(records, 'holding');
  const cost = list.reduce((a, h) => a + h.units * h.buyPrice, 0);
  const value = list.reduce((a, h) => a + h.units * h.price, 0);
  const pl = value - cost;
  return (
    <div className="page">
      <PageHead title={t.portfolio} sub={t.pfSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="trend" title={t.pfEmpty} hint={t.pfEmptyHint} /> : (
        <>
          <div className="stats card">
            <div><small>{t.pfValue}</small><b>{money(value)}</b></div>
            <div><small>{t.pfCost}</small><b>{money(cost)}</b></div>
            <div><small>{t.pfPl}</small><b className={pl < 0 ? 'neg' : ''}>{pl >= 0 ? '+' : ''}{money(pl)}{cost > 0 ? ` (${pctText((pl / cost) * 100)})` : ''}</b></div>
          </div>
          {KINDS.map((k) => {
            const items = list.filter((h) => h.type === k);
            if (!items.length) return null;
            return (
              <section key={k}>
                <h2 className="sec-title">{t.pfKinds[k]}</h2>
                <div className="card">
                  {items.map((h) => {
                    const v = h.units * h.price; const d = v - h.units * h.buyPrice;
                    return (
                      <button key={h.id} className="bill" onClick={() => setEdit(h)}>
                        <span className="bill-main"><span className="bill-title">{h.name}</span>
                          <span className="bill-sub">{h.units.toLocaleString('id-ID')} × {money(h.price)}</span></span>
                        <span className="bill-end"><span className="bill-amt">{money(v)}</span>
                          <span className={`bill-sub ${d < 0 ? 'neg' : ''}`}>{d >= 0 ? '+' : ''}{money(d)} ({pctText(h.buyPrice ? (d / (h.units * h.buyPrice)) * 100 : 0)})</span></span>
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
  const [err, setErr] = useState('');
  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const totals = splitTotals(s);
  const addPerson = () => { if (person.trim()) { set({ people: [...s.people, person.trim()] }); setPerson(''); } };
  const addItem = () => { if (iname.trim() && num(iprice) > 0) { set({ items: [...s.items, { name: iname.trim(), price: num(iprice), who: [] }] }); setIname(''); setIprice(''); } };
  const removePerson = (i) => set({
    people: s.people.filter((_, j) => j !== i), paid: (s.paid || []).filter((_, j) => j !== i),
    items: s.items.map((it) => ({ ...it, who: (it.who || []).filter((j) => j !== i).map((j) => (j > i ? j - 1 : j)) })),
  });
  const toggleWho = (k, i) => set({ items: s.items.map((it, j) => (j !== k ? it : { ...it, who: (it.who || []).includes(i) ? it.who.filter((x) => x !== i) : [...(it.who || []), i] })) });
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
          <div className="row static sum"><span className="grow">{t.subtotal} {money(totals.subtotal)} · {t.splitService} {money(totals.service)} · {t.splitTax} {money(totals.tax)}</span><b className="bill-amt">{money(totals.total)}</b></div>
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
                  <span className="rank-top"><span>{s.title}</span><b>{money(tot.total)}</b></span>
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

// ---------- chat logger: keyword rules, not a language model ----------
const CHAT_KEY = 'kasku.v1.chat';
export function Chat({ onOpenBill }) {
  const t = useT(); const { records, settings } = useStore(); const lang = settings.lang;
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch { return []; } });
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-60))); end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  function send(e) {
    e.preventDefault();
    const said = text.trim();
    if (!said) return;
    setText('');
    const p = parseQuick(said, records);
    const acc = records[settings.lastAccountId] && !records[settings.lastAccountId].deleted ? records[settings.lastAccountId] : live(records, 'account')[0];
    if (!p || !p.category || !acc) return setMsgs((m) => [...m, { me: said }, { bot: t.chatNoAmount }]);
    const id = uid();
    store.put({ id, kind: 'bill', type: p.type, amount: p.amount, note: p.note.slice(0, 120), time: Date.now(), bookId: settings.bookId, accountId: acc.id, toAccountId: null, categoryId: p.category.id, memberId: 'mem-me', createdAt: Date.now() });
    setMsgs((m) => [...m, { me: said }, { billId: id }]);
  }
  const billText = (b) => `${t[b.type]} ${formatMoney(b.amount, records[b.accountId]?.currency || settings.currency, lang)} · ${nameOf(records[b.categoryId], lang)} · ${nameOf(records[b.accountId], lang)}`;
  return (
    <div className="page chat">
      <PageHead title={t.chat} sub={t.chatSub} action={msgs.length > 0 && <button className="btn sm" onClick={() => setMsgs([])}>{t.chatClear}</button>} />
      <div className="chat-log" aria-live="polite">
        <div className="bubble bot">{t.chatHello}</div>
        {msgs.map((m, i) => {
          if (m.me) return <div key={i} className="bubble me">{m.me}</div>;
          if (m.bot) return <div key={i} className="bubble bot">{m.bot}</div>;
          const b = records[m.billId];
          if (!b || b.deleted) return <div key={i} className="bubble bot muted">{t.chatUndone}</div>;
          return (
            <div key={i} className="bubble bot">
              <span>{t.chatSaved} {billText(b)}</span>
              <span className="btn-row">
                <button className="btn sm" onClick={() => onOpenBill(b)}>{t.edit}</button>
                <button className="btn sm" onClick={() => store.remove(b.id)}>{t.chatUndo}</button>
              </span>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="chat-in" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.chatPh} aria-label={t.chat} maxLength={140} autoComplete="off" />
        <button className="btn primary" type="submit" aria-label={t.chatSend} disabled={!text.trim()}><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}

// ---------- calculators ----------
function Result({ rows }) {
  return <div className="card pad-card">{rows.map(([k, v, strong]) => <div key={k} className={`kv ${strong ? 'strong' : ''}`}><span>{k}</span><b>{v}</b></div>)}</div>;
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
          <Result rows={[[t.kprPay, money(Math.round(r.pay)), true], [t.kprLoan, money(r.loan)], [t.kprDpAmt, money(r.dp)], [t.kprInterest, money(Math.round(r.interest))], [t.kprTotal, money(Math.round(r.total))]]} />
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
          <Result rows={[[t.pphMonthly, money(Math.round(r.monthly)), true], [t.pphTakeHome, money(Math.round(r.takeHome))], [t.pphYearly, money(Math.round(r.tax))],
            [t.pphAnnual, money(r.annual)], [t.pphJabatan, money(r.jabatan)], [`PTKP (${married ? 'K' : 'TK'}/${deps})`, money(r.ptkp)], ['PKP', money(r.pkp)]]} />
          {r.parts.length > 0 && <Result rows={r.parts.map((p) => [`${p.rate * 100}% × ${money(p.slice)}`, money(Math.round(p.tax))])} />}
          <p className="hint gut">{t.pphNote}</p>
        </div>
      </div>
    </div>
  );
}
