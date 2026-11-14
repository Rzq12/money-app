import React, { useState } from 'react';
import { store, useStore, live, nameOf, uid, accountBalances, LIABILITY, CURRENCIES } from './store.js';
import { useT, useMoney, CatIcon, Icon, Sheet, IconPicker, confirmAsk } from './ui.jsx';
import { BillRow } from './Ledger.jsx';

const TYPES = ['cash', 'debit', 'credit', 'ewallet', 'invest', 'receivable', 'payable', 'other'];
const TYPE_ICON = { cash: '💵', debit: '💳', credit: '💳', ewallet: '📲', invest: '📈', receivable: '🤝', payable: '🧾', other: '🏦' };

function AccountEditor({ acc, onClose }) {
  const t = useT(); const { records, settings } = useStore();
  const [type, setType] = useState(acc?.type || 'cash');
  const [name, setName] = useState(acc ? nameOf(acc, settings.lang) : '');
  const [bal, setBal] = useState(acc ? String(acc.initBalance ?? 0) : '');
  const [currency, setCurrency] = useState(acc?.currency || settings.currency);
  const [icon, setIcon] = useState(acc?.icon || TYPE_ICON.cash);
  const [color, setColor] = useState(acc?.color || '#29bc9b');
  const [note, setNote] = useState(acc?.note || '');
  const [err, setErr] = useState('');
  function save() {
    if (!name.trim()) return setErr(t.accountName + '?');
    store.put({ id: acc?.id || uid(), kind: 'account', type, name: name.trim(), initBalance: parseFloat(bal) || 0, currency, icon, color, note, order: acc?.order ?? Date.now() });
    onClose();
  }
  function del() {
    const n = live(records, 'account').length;
    if (n <= 1) return alert(t.keepOneAccount);
    if (!confirmAsk(t.deleteAccountQ)) return;
    live(records, 'bill').filter((b) => b.accountId === acc.id || b.toAccountId === acc.id).forEach((b) => store.remove(b.id));
    store.remove(acc.id); onClose();
  }
  return (
    <Sheet open onClose={onClose} title={acc ? t.editAccount : t.newAccount} full
      actions={<>{acc && <button className="text-btn danger" onClick={del}>{t.delete}</button>}<button className="text-btn strong" onClick={save}>{t.save}</button></>}>
      <div className="form">
        <label className="field"><span>{t.accountType}</span>
          <div className="type-grid">
            {TYPES.map((ty) => (
              <button key={ty} type="button" className={`type-cell ${type === ty ? 'on' : ''}`} onClick={() => { setType(ty); if (!acc) setIcon(TYPE_ICON[ty]); }}>
                <span>{TYPE_ICON[ty]}</span>{t.types[ty]}
              </button>
            ))}
          </div>
          {t.typeDesc[type] && <small className="hint">{t.typeDesc[type]}</small>}
        </label>
        <label className="field"><span>{t.accountName}</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        <label className="field"><span>{LIABILITY.has(type) ? `${t.initBalance} (${t.debt}: -)` : t.initBalance}</span>
          <input inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value.replace(/[^0-9.-]/g, ''))} placeholder="0" /></label>
        <label className="field"><span>{t.currency}</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field"><span>{t.note}</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} /></label>
        <div className="field"><span>{t.icon}</span><IconPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} /></div>
        {err && <div className="err">{err}</div>}
      </div>
    </Sheet>
  );
}

function AccountDetail({ acc, balance, onClose, onEdit, onOpenBill }) {
  const t = useT(); const money = useMoney(); const { records, settings } = useStore();
  const bills = live(records, 'bill').filter((b) => b.accountId === acc.id || b.toAccountId === acc.id).sort((a, b) => b.time - a.time).slice(0, 100);
  return (
    <Sheet open onClose={onClose} title={nameOf(acc, settings.lang)} full actions={<button className="text-btn strong" onClick={onEdit}>{t.edit}</button>}>
      <div className="acc-hero">
        <span>{acc.color && <i style={{ background: acc.color }} />}{t.balance}</span><b>{money(balance)}</b><small>{t.types[acc.type]} · {acc.currency}</small>
      </div>
      {bills.length ? <div className="card">{bills.map((b) => <BillRow key={b.id} b={b} onOpen={onOpenBill} />)}</div> : <p className="empty small">{t.noBill}</p>}
    </Sheet>
  );
}

export default function Wallet({ onOpenBill }) {
  const t = useT(); const money = useMoney(); const { records, settings } = useStore();
  const [edit, setEdit] = useState(null); const [detail, setDetail] = useState(null);
  const accounts = live(records, 'account');
  const bal = accountBalances(records);
  let asset = 0; let debt = 0;
  for (const a of accounts) { const v = bal[a.id] || 0; if (v >= 0) asset += v; else debt += -v; }
  const groups = TYPES.map((ty) => [ty, accounts.filter((a) => a.type === ty)]).filter(([, l]) => l.length);
  return (
    <div className="page">
      <div className="hero">
        <div className="hero-top"><h1 className="hero-title">{t.wallet}</h1>
          <button className="icon-btn ring" aria-label={t.newAccount} onClick={() => setEdit('new')}><Icon name="plus" size={18} /></button></div>
        <div className="hero-label">{t.netAsset}</div>
        <div className="hero-big">{money(asset - debt)}</div>
        <div className="hero-row"><span>{t.asset} <b>{money(asset)}</b></span><span>{t.debt} <b>{money(debt)}</b></span></div>
      </div>
      {groups.map(([ty, list]) => (
        <section key={ty} className="day">
          <header className="day-head plain"><span className="day-name">{t.types[ty]}</span>
            <span className="day-sum"><span>{money(list.reduce((s, a) => s + (bal[a.id] || 0), 0))}</span></span></header>
          <div className="card">
            {list.map((a) => (
              <button key={a.id} className="bill" onClick={() => setDetail(a)}>
                <CatIcon icon={a.icon} color={a.color} size={40} />
                <span className="bill-main"><span className="bill-title">{nameOf(a, settings.lang)}</span>
                  <span className="bill-sub">{a.currency}{a.note ? ` · ${a.note}` : ''}</span></span>
                <span className={`bill-amt ${(bal[a.id] || 0) < 0 ? 'neg' : ''}`}>{money(bal[a.id] || 0)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="wide-btn" onClick={() => setEdit('new')}><Icon name="plus" size={16} />{t.newAccount}</button>
      {edit && <AccountEditor acc={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {detail && records[detail.id] && !records[detail.id].deleted && (
        <AccountDetail acc={records[detail.id]} balance={bal[detail.id] || 0} onClose={() => setDetail(null)}
          onEdit={() => { setEdit(records[detail.id]); setDetail(null); }} onOpenBill={onOpenBill} />
      )}
    </div>
  );
}
