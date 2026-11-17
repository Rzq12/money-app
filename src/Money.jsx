// Budgets, goals, debts, recurring transactions and auto-category rules.
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { store, useStore, live, nameOf, uid, formatMoney } from './store.js';
import { useT, useMoney, CatIcon, Icon, Sheet, Segmented, PageHead, Empty, AddBtn, Progress, confirmAsk } from './ui.jsx';
import { budgetSpent, goalSaved, parseNumber, toDateInput, fromDateInput, nextAfter, runRecurring, hasRate } from './logic.js';

export const num = (s) => { const n = parseNumber(s); return Number.isNaN(n) ? 0 : n; };
export function Field({ label, hint, children }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="hint">{hint}</small>}</label>;
}
export function AmountInput({ value, onChange, autoFocus, placeholder = '0' }) {
  return <input inputMode="decimal" autoFocus={autoFocus} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ''))} />;
}
export function AccountSelect({ value, onChange, exclude }) {
  const { records, settings } = useStore();
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {live(records, 'account').filter((a) => a.id !== exclude).map((a) => <option key={a.id} value={a.id}>{nameOf(a, settings.lang)} ({a.currency})</option>)}
    </select>
  );
}
// Category field: a button showing the chosen category's icon that opens a list with every icon.
// (A native <select> can only show text, and the icons are drawn SVGs.)
export function CategorySelect({ value, onChange, type, all }) {
  const t = useT(); const { records, settings } = useStore();
  const [open, setOpen] = useState(false);
  const cats = live(records, 'category');
  const cur = value ? cats.find((c) => c.id === value) : null;
  const groups = type ? [[null, type]] : [[t.expense, 'expense'], [t.income, 'income']];
  const choose = (id) => { onChange(id); setOpen(false); };
  const tick = <span className="check"><Icon name="check" size={18} /></span>;
  return (
    <>
      <button type="button" className="select-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {cur ? <CatIcon icon={cur.icon} color={cur.color} size={26} /> : <span className="caticon ph sm"><Icon name="grid" size={14} /></span>}
        <span className="grow">{cur ? nameOf(cur, settings.lang) : all || t.category}</span>
        <Icon name="chevD" size={16} />
      </button>
      {/* Portal: the field sits inside a <label>, and a click anywhere in it would reopen the list. */}
      {open && createPortal(
        <Sheet open onClose={() => setOpen(false)} title={t.category}>
          <div className="pick-list">
            {all && (
              <button className="row" onClick={() => choose('')}>
                <span className="caticon ph"><Icon name="grid" size={16} /></span><span className="grow">{all}</span>{!value && tick}
              </button>
            )}
            {groups.map(([label, ty]) => (
              <React.Fragment key={ty}>
                {label && <h3 className="sec-title">{label}</h3>}
                {cats.filter((c) => c.type === ty).map((c) => (
                  <button key={c.id} className="row" onClick={() => choose(c.id)}>
                    <CatIcon icon={c.icon} color={c.color} size={34} /><span className="grow">{nameOf(c, settings.lang)}</span>{c.id === value && tick}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </Sheet>,
        document.body,
      )}
    </>
  );
}
export function EditActions({ onSave, onDelete }) {
  const t = useT();
  return <>{onDelete && <button className="text-btn danger" onClick={onDelete}>{t.delete}</button>}<button className="text-btn strong" onClick={onSave}>{t.save}</button></>;
}
const fmtDate = (ms, lang) => new Date(ms).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
async function removeAfterAsk(t, id, onClose) {
  if (await confirmAsk(`${t.delete}?`, { danger: true, okLabel: t.delete })) { store.remove(id); onClose(); }
}

// ---------- budgets ----------
function BudgetEditor({ item, onClose }) {
  const t = useT(); const { records, settings } = useStore();
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [period, setPeriod] = useState(item?.period || 'month');
  const [start, setStart] = useState(toDateInput(item?.start || Date.now()));
  const [end, setEnd] = useState(toDateInput(item?.end || Date.now() + 29 * 86400000));
  const [err, setErr] = useState('');
  function save() {
    const n = num(amount);
    if (!(n > 0)) return setErr(t.enterAmount);
    if (period === 'custom' && fromDateInput(end) < fromDateInput(start)) return setErr(t.badRange);
    // One budget per category and period: saving the same pair again updates it.
    const same = live(records, 'budget').find((b) => b.bookId === settings.bookId && (b.categoryId || '') === categoryId && (b.period || 'month') === period && period !== 'custom');
    const id = item?.id || same?.id || (!categoryId && period === 'month' ? `budget-${settings.bookId}` : uid());
    store.put({ id, kind: 'budget', bookId: settings.bookId, categoryId: categoryId || null, amount: n, period, deleted: false,
      start: period === 'custom' ? fromDateInput(start, 0) : null, end: period === 'custom' ? fromDateInput(end, 0) : null });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={item ? t.budgetEdit : t.budgetNew}
      actions={<EditActions onSave={save} onDelete={item && (() => removeAfterAsk(t, item.id, onClose))} />}>
      <div className="form">
        <Field label={t.category}><CategorySelect value={categoryId} onChange={setCategoryId} type="expense" all={t.allCategories} /></Field>
        <Field label={t.budgetAmount}><AmountInput value={amount} onChange={setAmount} autoFocus /></Field>
        <div className="field"><span>{t.period}</span>
          <Segmented label={t.period} value={period} onChange={setPeriod} options={['week', 'month', 'year', 'custom'].map((p) => ({ value: p, label: t.periods[p] }))} /></div>
        {period === 'custom' && (
          <div className="two">
            <Field label={t.from}><input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></Field>
            <Field label={t.until}><input type="date" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} /></Field>
          </div>
        )}
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}
export function Budgets() {
  const t = useT(); const money = useMoney(); const { records, settings } = useStore(); const lang = settings.lang;
  const [edit, setEdit] = useState(null);
  const list = live(records, 'budget').filter((b) => b.bookId === settings.bookId);
  return (
    <div className="page">
      <PageHead title={t.budget} sub={t.budgetSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="target" title={t.budgetEmpty} hint={t.budgetEmptyHint} /> : (
        <div className="card">
          {list.map((b) => {
            const { spent, start, end } = budgetSpent(b, records, settings);
            const c = records[b.categoryId]; const left = b.amount - spent;
            return (
              <button key={b.id} className="row tall" onClick={() => setEdit(b)}>
                <CatIcon icon={c ? c.icon : <Icon name="target" size={18} />} color={c?.color} size={36} />
                <span className="rank-main">
                  <span className="rank-top"><span>{c ? nameOf(c, lang) : t.allCategories}</span><b>{money(spent)} / {money(b.amount)}</b></span>
                  <Progress value={spent} max={b.amount} over={left < 0} />
                  <span className="rank-top sub">
                    <small>{t.periods[b.period || 'month']} · {fmtDate(start, lang)} – {fmtDate(end - 1, lang)}</small>
                    <small className={left < 0 ? 'neg' : ''}>{left < 0 ? `${t.overBudget} ${money(-left)}` : `${t.budgetLeft} ${money(left)}`}</small>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {edit && <BudgetEditor item={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------- goals ----------
function GoalEditor({ item, onClose }) {
  const t = useT(); const { records } = useStore();
  const [name, setName] = useState(item?.name || '');
  const [target, setTarget] = useState(item ? String(item.target) : '');
  const [accountId, setAccountId] = useState(item?.accountId || live(records, 'account')[0]?.id);
  const [due, setDue] = useState(item?.due ? toDateInput(item.due) : '');
  const [err, setErr] = useState('');
  function save() {
    if (!name.trim()) return setErr(t.needName);
    if (!(num(target) > 0)) return setErr(t.enterAmount);
    store.put({ id: item?.id || uid(), kind: 'goal', name: name.trim(), target: num(target), accountId, due: due ? fromDateInput(due) : null, order: item?.order ?? Date.now() });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={item ? t.goalEdit : t.goalNew}
      actions={<EditActions onSave={save} onDelete={item && (() => removeAfterAsk(t, item.id, onClose))} />}>
      <div className="form">
        <Field label={t.goalName}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus /></Field>
        <Field label={t.goalTarget}><AmountInput value={target} onChange={setTarget} /></Field>
        <Field label={t.goalAccount} hint={t.goalAccountHint}><AccountSelect value={accountId} onChange={setAccountId} /></Field>
        <Field label={t.goalDue}><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}
function GoalDeposit({ goal, onClose }) {
  const t = useT(); const { records, settings } = useStore();
  const sources = live(records, 'account').filter((a) => a.id !== goal.accountId);
  const [from, setFrom] = useState(sources.find((a) => a.id === settings.lastAccountId)?.id || sources[0]?.id);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  function save() {
    if (!from) return setErr(t.goalNeedSource);
    if (!(num(amount) > 0)) return setErr(t.enterAmount);
    store.put({ id: uid(), kind: 'bill', type: 'transfer', amount: num(amount), note: `${t.goalDeposit}: ${goal.name}`, time: Date.now(),
      bookId: settings.bookId, accountId: from, toAccountId: goal.accountId, categoryId: null, memberId: 'mem-me', goalId: goal.id, createdAt: Date.now() });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={`${t.goalDeposit}: ${goal.name}`} actions={<button className="text-btn strong" onClick={save}>{t.goalDeposit}</button>}>
      <div className="form">
        <p className="intro">{t.goalDepositIntro.replace('{acc}', nameOf(records[goal.accountId], settings.lang))}</p>
        {sources.length ? <Field label={t.from}><AccountSelect value={from} onChange={setFrom} exclude={goal.accountId} /></Field> : <p className="err">{t.goalNeedSource}</p>}
        <Field label={t.amount}><AmountInput value={amount} onChange={setAmount} autoFocus /></Field>
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}
export function Goals() {
  const t = useT(); const { records, settings } = useStore(); const lang = settings.lang;
  const [edit, setEdit] = useState(null); const [dep, setDep] = useState(null);
  const list = live(records, 'goal');
  return (
    <div className="page">
      <PageHead title={t.goals} sub={t.goalsSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="flag" title={t.goalEmpty} hint={t.goalEmptyHint} /> : list.map((g) => {
        const acc = records[g.accountId]; const cur = acc?.currency || settings.currency;
        const saved = goalSaved(g, records, settings.currency); const fm = (v) => formatMoney(v, cur, lang);
        const done = saved >= g.target;
        return (
          <div key={g.id} className="card pad-card">
            <div className="rank-top"><span>{g.name}</span><b>{fm(saved)} / {fm(g.target)}</b></div>
            <Progress value={saved} max={g.target} />
            <div className="rank-top sub">
              <small>{nameOf(acc, lang)}{g.due ? ` · ${t.goalDue} ${fmtDate(g.due, lang)}` : ''}</small>
              <small>{done ? t.goalReached : `${t.goalLeft} ${fm(g.target - saved)}`}</small>
            </div>
            <div className="btn-row">
              <button className="btn primary" onClick={() => setDep(g)}>{t.goalDeposit}</button>
              <button className="btn" onClick={() => setEdit(g)}>{t.edit}</button>
            </div>
          </div>
        );
      })}
      {edit && <GoalEditor item={edit.id ? edit : null} onClose={() => setEdit(null)} />}
      {dep && <GoalDeposit goal={dep} onClose={() => setDep(null)} />}
    </div>
  );
}

// ---------- debts ----------
const paidOf = (d) => (d.payments || []).reduce((a, p) => a + p.amount, 0);
function DebtEditor({ item, onClose }) {
  const t = useT();
  const [dir, setDir] = useState(item?.dir || 'owe');
  const [person, setPerson] = useState(item?.person || '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [note, setNote] = useState(item?.note || '');
  const [due, setDue] = useState(item?.due ? toDateInput(item.due) : '');
  const [pay, setPay] = useState('');
  const [err, setErr] = useState('');
  const left = item ? item.amount - paidOf(item) : 0;
  function save() {
    if (!person.trim()) return setErr(t.needName);
    if (!(num(amount) > 0)) return setErr(t.enterAmount);
    store.put({ id: item?.id || uid(), kind: 'debt', dir, person: person.trim(), amount: num(amount), note: note.trim(), due: due ? fromDateInput(due) : null,
      time: item?.time || Date.now(), payments: item?.payments || [] });
    onClose();
  }
  function addPay(v) {
    const n = Math.min(num(v), left);
    if (!(n > 0)) return;
    store.put({ id: item.id, payments: [...(item.payments || []), { amount: n, time: Date.now() }] });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={item ? t.debtEdit : t.debtNew} full
      actions={<EditActions onSave={save} onDelete={item && (() => removeAfterAsk(t, item.id, onClose))} />}>
      <div className="form">
        <Segmented label={t.debts} value={dir} onChange={setDir} options={[{ value: 'owe', label: t.debtOwe }, { value: 'lent', label: t.debtLent }]} />
        <Field label={t.debtPerson}><input value={person} onChange={(e) => setPerson(e.target.value)} maxLength={40} autoFocus={!item} /></Field>
        <Field label={t.amount}><AmountInput value={amount} onChange={setAmount} /></Field>
        <Field label={t.goalDue}><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label={t.note}><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} /></Field>
        {err && <div className="err" role="alert">{err}</div>}
        {item && left > 0 && (
          <div className="card pad-card">
            <Field label={t.debtPay}><AmountInput value={pay} onChange={setPay} placeholder={String(left)} /></Field>
            <div className="btn-row">
              <button className="btn primary" disabled={!(num(pay) > 0)} onClick={() => addPay(pay)}>{t.debtPay}</button>
              <button className="btn" onClick={() => addPay(left)}>{t.debtPayAll}</button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
export function Debts() {
  const t = useT(); const money = useMoney(); const { records, settings } = useStore(); const lang = settings.lang;
  const [edit, setEdit] = useState(null);
  const list = live(records, 'debt').sort((a, b) => b.time - a.time);
  const sum = (dir) => list.filter((d) => d.dir === dir).reduce((a, d) => a + Math.max(0, d.amount - paidOf(d)), 0);
  const group = (dir, title) => {
    const items = list.filter((d) => d.dir === dir);
    if (!items.length) return null;
    return (
      <section>
        <h2 className="sec-title">{title}</h2>
        <div className="card">
          {items.map((d) => {
            const paid = paidOf(d); const left = d.amount - paid; const late = d.due && left > 0 && d.due < Date.now();
            return (
              <button key={d.id} className="row tall" onClick={() => setEdit(d)}>
                <span className="rank-main">
                  <span className="rank-top"><span>{d.person}</span><b>{left > 0 ? money(left) : t.paidOff}</b></span>
                  <Progress value={paid} max={d.amount} />
                  <span className="rank-top sub">
                    <small>{d.note || fmtDate(d.time, lang)}</small>
                    <small className={late ? 'neg' : ''}>{d.due ? `${t.goalDue} ${fmtDate(d.due, lang)}` : `${t.total} ${money(d.amount)}`}</small>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };
  return (
    <div className="page">
      <PageHead title={t.debts} sub={t.debtsSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="swapV" title={t.debtEmpty} hint={t.debtEmptyHint} /> : (
        <>
          <div className="stats two card">
            <div><small>{t.debtOweSum}</small><b>{money(sum('owe'))}</b></div>
            <div><small>{t.debtLentSum}</small><b>{money(sum('lent'))}</b></div>
          </div>
          {group('owe', t.debtOwe)}{group('lent', t.debtLent)}
        </>
      )}
      {edit && <DebtEditor item={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------- recurring ----------
function RecurringEditor({ item, onClose }) {
  const t = useT(); const { records, settings } = useStore();
  const accounts = live(records, 'account');
  const [type, setType] = useState(item?.type || 'expense');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [accountId, setAccountId] = useState(item?.accountId || settings.lastAccountId || accounts[0]?.id);
  const [toAccountId, setToAccountId] = useState(item?.toAccountId || accounts.find((a) => a.id !== accountId)?.id);
  const [note, setNote] = useState(item?.note || '');
  const [freq, setFreq] = useState(item?.freq || 'monthly');
  const [start, setStart] = useState(toDateInput(item?.next || Date.now()));
  const [err, setErr] = useState('');
  const catType = type === 'income' ? 'income' : 'expense';
  const cat = records[categoryId]?.type === catType ? categoryId : live(records, 'category').find((c) => c.type === catType)?.id;
  function save() {
    if (!(num(amount) > 0)) return setErr(t.enterAmount);
    if (type === 'transfer' && (!toAccountId || !records[toAccountId] || records[toAccountId].deleted)) return setErr(t.needToAccount);
    if (type === 'transfer' && accountId === toAccountId) return setErr(t.sameAccount);
    if (type === 'transfer') {
      const miss = [records[accountId]?.currency, records[toAccountId]?.currency].find((c) => !hasRate(records, c, settings.currency));
      if (miss && records[accountId]?.currency !== records[toAccountId]?.currency) return setErr(t.needRate.replace('{code}', miss));
    }
    const next = fromDateInput(start, 9);
    store.put({ id: item?.id || uid(), kind: 'recurring', type, amount: num(amount), categoryId: type === 'transfer' ? null : cat, accountId,
      toAccountId: type === 'transfer' ? toAccountId : null, note: note.trim(), freq, next, day: new Date(next).getDate(), bookId: settings.bookId, active: item?.active ?? true });
    runRecurring();
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={item ? t.recEdit : t.recNew} full
      actions={<EditActions onSave={save} onDelete={item && (() => removeAfterAsk(t, item.id, onClose))} />}>
      <div className="form">
        <Segmented label={t.type} value={type} onChange={setType} options={[{ value: 'expense', label: t.expShort }, { value: 'income', label: t.incShort }, { value: 'transfer', label: t.transfer }]} />
        <Field label={t.amount}><AmountInput value={amount} onChange={setAmount} autoFocus={!item} /></Field>
        {type !== 'transfer' && <Field label={t.category}><CategorySelect value={cat} onChange={setCategoryId} type={catType} /></Field>}
        <Field label={type === 'transfer' ? t.from : t.account}><AccountSelect value={accountId} onChange={setAccountId} /></Field>
        {type === 'transfer' && <Field label={t.to}><AccountSelect value={toAccountId} onChange={setToAccountId} /></Field>}
        <Field label={t.note}><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} /></Field>
        <div className="field"><span>{t.recFreq}</span>
          <Segmented label={t.recFreq} value={freq} onChange={setFreq} options={['daily', 'weekly', 'monthly'].map((f) => ({ value: f, label: t.freqs[f] }))} /></div>
        <Field label={item ? t.recNext : t.recStart} hint={t.recStartHint}><input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></Field>
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}
export function Recurring() {
  const t = useT(); const { records, settings } = useStore(); const lang = settings.lang;
  const [edit, setEdit] = useState(null);
  const list = live(records, 'recurring');
  return (
    <div className="page">
      <PageHead title={t.recurring} sub={t.recSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="repeat" title={t.recEmpty} hint={t.recEmptyHint} /> : (
        <div className="card">
          {list.map((r) => {
            const c = records[r.categoryId]; const acc = records[r.accountId];
            const title = r.type === 'transfer' ? `${nameOf(acc, lang)} → ${nameOf(records[r.toAccountId], lang)}` : nameOf(c, lang);
            return (
              <div key={r.id} className="row split-row">
                <button className="row-main" onClick={() => setEdit(r)}>
                  <CatIcon icon={r.type === 'transfer' ? <Icon name="swap" size={18} /> : c?.icon} color={c?.color} size={36} />
                  <span className="bill-main">
                    <span className="bill-title">{title}{r.note ? ` · ${r.note}` : ''}</span>
                    <span className="bill-sub">{t.freqs[r.freq]} · {r.active ? `${t.recNext} ${fmtDate(r.next, lang)}` : t.recPaused}</span>
                  </span>
                  <span className={`bill-amt ${r.type}`}>{r.type === 'expense' ? '-' : r.type === 'income' ? '+' : ''}{formatMoney(r.amount, acc?.currency || settings.currency, lang)}</span>
                </button>
                <input type="checkbox" className="switch" aria-label={t.recActive} checked={!!r.active}
                  onChange={(e) => { store.put({ id: r.id, active: e.target.checked, next: e.target.checked && r.next ? nextAfter(r.next, r.freq, r.day) : r.next }); }} />
              </div>
            );
          })}
        </div>
      )}
      {edit && <RecurringEditor item={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------- auto-category rules ----------
function RuleEditor({ item, onClose }) {
  const t = useT(); const { records } = useStore();
  const [keyword, setKeyword] = useState(item?.keyword || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || live(records, 'category')[0]?.id);
  const [err, setErr] = useState('');
  function save() {
    if (keyword.trim().length < 2) return setErr(t.ruleNeedKeyword);
    store.put({ id: item?.id || uid(), kind: 'rule', keyword: keyword.trim(), categoryId, order: item?.order ?? Date.now() });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={item ? t.ruleEdit : t.ruleNew}
      actions={<EditActions onSave={save} onDelete={item && (() => removeAfterAsk(t, item.id, onClose))} />}>
      <div className="form">
        <Field label={t.ruleKeyword} hint={t.ruleKeywordHint}><input value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={30} autoFocus /></Field>
        <Field label={t.category}><CategorySelect value={categoryId} onChange={setCategoryId} /></Field>
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </Sheet>
  );
}
export function Rules() {
  const t = useT(); const { records, settings } = useStore();
  const [edit, setEdit] = useState(null);
  const list = live(records, 'rule');
  return (
    <div className="page">
      <PageHead title={t.rules} sub={t.rulesSub} action={<AddBtn label={t.add} onClick={() => setEdit({})} />} />
      {!list.length ? <Empty icon="filter" title={t.ruleEmpty} hint={t.ruleEmptyHint} /> : (
        <div className="card">
          {list.map((r) => {
            const c = records[r.categoryId];
            return (
              <button key={r.id} className="row" onClick={() => setEdit(r)}>
                <CatIcon icon={c?.icon} color={c?.color} size={36} />
                <span className="bill-main"><span className="bill-title">“{r.keyword}”</span>
                  <span className="bill-sub">{c && !c.deleted ? `${t[c.type]} · ${nameOf(c, settings.lang)}` : t.ruleNoCat}</span></span>
                <span className="chev"><Icon name="chevR" size={16} /></span>
              </button>
            );
          })}
        </div>
      )}
      {edit && <RuleEditor item={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}
