import React, { useMemo, useState } from 'react';
import { store, useStore, live, nameOf, uid } from './store.js';
import { useT, CatIcon, Icon, Sheet, Segmented, confirmAsk } from './ui.jsx';

function evalExpr(s) {
  const parts = s.match(/[+-]?[0-9.]+/g);
  if (!parts) return 0;
  return Math.round(parts.reduce((a, p) => a + (parseFloat(p) || 0), 0) * 100) / 100;
}
const toLocalInput = (ms) => {
  const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function BillEditor({ bill, onClose, defaultTime }) {
  const t = useT();
  const { records, settings } = useStore();
  const lang = settings.lang;
  const accounts = live(records, 'account').filter((a) => !a.archived);
  const members = live(records, 'member');
  const [type, setType] = useState(bill?.type || 'expense');
  const cats = useMemo(() => live(records, 'category').filter((c) => c.type === (type === 'income' ? 'income' : 'expense')), [records, type]);
  const [categoryId, setCategoryId] = useState(bill?.categoryId || null);
  const [expr, setExpr] = useState(bill ? String(bill.amount) : '');
  const [note, setNote] = useState(bill?.note || '');
  const [time, setTime] = useState(bill?.time || defaultTime || Date.now());
  const [accountId, setAccountId] = useState(bill?.accountId || settings.lastAccountId || accounts[0]?.id);
  const [toAccountId, setToAccountId] = useState(bill?.toAccountId || accounts.find((a) => a.id !== accountId)?.id);
  const [memberId, setMemberId] = useState(bill?.memberId || 'mem-me');
  const [err, setErr] = useState('');
  const [picker, setPicker] = useState(null); // 'account' | 'to' | 'member'

  const cat = records[categoryId] && records[categoryId].type === (type === 'income' ? 'income' : 'expense') ? records[categoryId] : null;
  const amount = evalExpr(expr);
  const hasOp = /[0-9.][+-]/.test(expr);

  function press(k) {
    setErr('');
    if (k === 'del') return setExpr((e) => e.slice(0, -1));
    if (k === '+' || k === '-') {
      return setExpr((e) => (e === '' ? e : /[+-]$/.test(e) ? e.slice(0, -1) + k : e + k));
    }
    if (k === '.') {
      return setExpr((e) => { const last = e.split(/[+-]/).pop(); return last.includes('.') ? e : e + (last === '' ? '0.' : '.'); });
    }
    setExpr((e) => {
      const last = e.split(/[+-]/).pop();
      if (last.includes('.') && last.split('.')[1].length >= 2) return e;
      if (last.replace('.', '').length >= 12) return e;
      return last === '0' ? e.slice(0, -1) + k : e + k;
    });
  }

  function save() {
    if (hasOp) { setExpr(String(amount)); return; }
    if (!(amount > 0)) return setErr(t.enterAmount);
    if (type !== 'transfer' && !cat) return setErr(t.pickCategory);
    if (type === 'transfer' && accountId === toAccountId) return setErr(t.sameAccount);
    store.put({
      id: bill?.id || uid(), kind: 'bill', type, amount, note: note.trim(), time,
      bookId: bill?.bookId || settings.bookId, accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? null : cat.id, memberId,
      createdAt: bill?.createdAt || Date.now(),
    });
    store.setSettings({ lastAccountId: accountId });
    onClose();
  }

  function del() {
    if (confirmAsk(t.deleteBillQ)) { store.remove(bill.id); onClose(); }
  }

  const acc = records[accountId]; const toAcc = records[toAccountId]; const mem = records[memberId];
  const keys = ['7', '8', '9', 'date', '4', '5', '6', '+', '1', '2', '3', '-', '.', '0', 'del', 'ok'];

  return (
    <Sheet open onClose={onClose} full title={bill ? t.edit : t.add}
      actions={bill && <button className="text-btn danger" onClick={del}>{t.delete}</button>}>
      <div className="editor">
        <Segmented value={type} onChange={(v) => { setType(v); setErr(''); }}
          options={[{ value: 'expense', label: t.expShort }, { value: 'income', label: t.incShort }, { value: 'transfer', label: t.transfer }]} />

        {type !== 'transfer' ? (
          <div className="cat-grid">
            {cats.map((c) => (
              <button key={c.id} className={`cat-cell ${cat?.id === c.id ? 'on' : ''}`} onClick={() => { setCategoryId(c.id); setErr(''); }}>
                <CatIcon icon={c.icon} color={c.color} size={46} />
                <span>{nameOf(c, lang)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="transfer-box">
            <button className="transfer-acc" onClick={() => setPicker('account')}>
              <small>{t.from}</small><CatIcon icon={acc?.icon} color={acc?.color} size={36} /><b>{nameOf(acc, lang)}</b>
            </button>
            <button className="swap" aria-label="swap" onClick={() => { setAccountId(toAccountId); setToAccountId(accountId); }}><Icon name="swap" size={18} /></button>
            <button className="transfer-acc" onClick={() => setPicker('to')}>
              <small>{t.to}</small><CatIcon icon={toAcc?.icon} color={toAcc?.color} size={36} /><b>{nameOf(toAcc, lang)}</b>
            </button>
          </div>
        )}

        <div className="pad">
          <div className="amount-row">
            {type !== 'transfer' && cat ? <CatIcon icon={cat.icon} color={cat.color} size={34} /> : <span className="caticon ph">{type === 'transfer' ? <Icon name="swap" size={16} /> : '?'}</span>}
            <input className="note-in" placeholder={t.notePh} value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
            <span className={`amount ${type}`} aria-live="polite">{expr || '0'}</span>
          </div>
          {err && <div className="err">{err}</div>}
          <div className="chips">
            <label className="chip">
              <Icon name="calendar" size={14} /><input type="datetime-local" aria-label={t.date} value={toLocalInput(time)} onChange={(e) => e.target.value && setTime(new Date(e.target.value).getTime())} />
            </label>
            {type !== 'transfer' && <button className="chip" onClick={() => setPicker('account')}>{acc?.icon} {nameOf(acc, lang)}</button>}
            <button className="chip" onClick={() => setPicker('member')}>{mem?.icon} {nameOf(mem, lang)}</button>
          </div>
          <div className="keys">
            {keys.map((k) => {
              if (k === 'date') return <button key={k} className="key fn" onClick={() => setTime(Date.now())}>{t.today}</button>;
              if (k === 'ok') return <button key={k} className="key ok" onClick={save}>{hasOp ? '=' : t.done}</button>;
              if (k === 'del') return <button key={k} className="key fn" aria-label="hapus" onClick={() => press('del')}><Icon name="backspace" /></button>;
              return <button key={k} className={`key ${k === '+' || k === '-' ? 'fn' : ''}`} onClick={() => press(k)}>{k}</button>;
            })}
          </div>
        </div>
      </div>

      <Sheet open={!!picker} onClose={() => setPicker(null)} title={picker === 'member' ? t.member : t.account}>
        <div className="pick-list">
          {(picker === 'member' ? members : accounts).map((x) => (
            <button key={x.id} className="row" onClick={() => {
              if (picker === 'member') setMemberId(x.id); else if (picker === 'to') setToAccountId(x.id); else setAccountId(x.id);
              setPicker(null);
            }}>
              <CatIcon icon={x.icon} color={x.color || '#ff0080'} size={34} /><span className="grow">{nameOf(x, lang)}</span>
              {((picker === 'member' && x.id === memberId) || (picker === 'to' && x.id === toAccountId) || (picker === 'account' && x.id === accountId)) && <span className="check"><Icon name="check" size={18} /></span>}
            </button>
          ))}
        </div>
      </Sheet>
    </Sheet>
  );
}
