import React, { useRef, useState } from 'react';
import { store, useStore, live, nameOf, uid, CURRENCIES, ACCENTS } from './store.js';
import { useT, useMoney, CatIcon, Icon, Logo, Sheet, Segmented, IconPicker, confirmAsk } from './ui.jsx';
import { useSync, configure, signIn, signOut, syncNow, SETUP_SQL, backupBlob, restoreBackup } from './sync.js';
import { billTitle } from './Ledger.jsx';

const THEMES = ACCENTS;

function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function SyncBadge() {
  const t = useT(); const { cfg, status } = useSync();
  const map = { off: t.notConnected, idle: t.synced, syncing: t.syncing, offline: t.offline, error: '⚠ ' + (status.error || 'error') };
  return <span className={`sync-badge ${status.phase}`} title={cfg.session?.user?.email || ''}>{map[status.phase] || ''}</span>;
}

function SyncSheet({ onClose }) {
  const t = useT(); const { cfg, status } = useSync(); const { settings } = useStore();
  const [url, setUrl] = useState(cfg.url); const [key, setKey] = useState(cfg.key);
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(''); const [showSql, setShowSql] = useState(false);
  async function go(create) {
    setMsg('');
    configure(url, key);
    try {
      const r = await signIn(email.trim(), pw, create);
      setMsg(r === 'confirm' ? (settings.lang === 'en' ? 'Check your email to confirm, then sign in.' : 'Cek email untuk konfirmasi, lalu masuk.') : '✓');
    } catch (e) { setMsg('⚠ ' + e.message); }
  }
  return (
    <Sheet open onClose={onClose} title={t.syncTitle} full>
      <div className="form">
        <p className="intro">{t.syncIntro}</p>
        {cfg.session ? (
          <div className="card pad-card">
            <div className="kv"><span>{t.email}</span><b>{cfg.session.user.email}</b></div>
            <div className="kv"><span>{t.sync}</span><SyncBadge /></div>
            <div className="kv"><span>{t.lastSync}</span><b>{cfg.lastSync ? new Date(cfg.lastSync).toLocaleString() : t.never}</b></div>
            <div className="btn-row">
              <button className="btn primary" onClick={() => syncNow()} disabled={status.phase === 'syncing'}>{t.syncNow}</button>
              <button className="btn" onClick={signOut}>{t.signOut}</button>
            </div>
          </div>
        ) : (
          <>
            <label className="field"><span>{t.serverUrl}</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" /></label>
            <label className="field"><span>{t.serverKey}</span><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" autoComplete="off" /></label>
            <label className="field"><span>{t.email}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label className="field"><span>{t.password}</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
            <div className="btn-row">
              <button className="btn primary" disabled={!url || !key || !email || pw.length < 6 || status.phase === 'syncing'} onClick={() => go(false)}>{t.signIn}</button>
              <button className="btn" disabled={!url || !key || !email || pw.length < 6 || status.phase === 'syncing'} onClick={() => go(true)}>{t.signUp}</button>
            </div>
          </>
        )}
        {msg && <div className={msg.startsWith('⚠') ? 'err' : 'ok-msg'}>{msg}</div>}
        <button className="text-btn" onClick={() => setShowSql((v) => !v)}><Icon name={showSql ? 'chevD' : 'chevR'} size={14} />{t.syncSetup}</button>
        {showSql && (
          <div className="setup">
            <ol>
              <li>supabase.com → New project (gratis / free).</li>
              <li>Project Settings → API: salin <b>Project URL</b> &amp; <b>anon public key</b> ke kolom di atas.</li>
              <li>SQL Editor → tempel kode ini → Run:</li>
            </ol>
            <pre>{SETUP_SQL}</pre>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(SETUP_SQL)}>Copy SQL</button>
            <p className="hint">Gunakan alamat, kunci dan akun yang sama di HP dan di website.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function NamedListSheet({ kind, title, onClose }) {
  const t = useT(); const { records, settings } = useStore(); const lang = settings.lang;
  const [ctype, setCtype] = useState('expense');
  const [edit, setEdit] = useState(null);
  let items = live(records, kind);
  if (kind === 'category') items = items.filter((c) => c.type === ctype);
  return (
    <Sheet open onClose={onClose} title={title} full actions={<button className="text-btn strong icon" aria-label={t.add} onClick={() => setEdit({})}><Icon name="plus" size={16} /></button>}>
      {kind === 'category' && <div className="toolbar"><Segmented value={ctype} onChange={setCtype} options={[{ value: 'expense', label: t.expense }, { value: 'income', label: t.income }]} /></div>}
      <div className="card">
        {items.map((x) => (
          <button key={x.id} className="row" onClick={() => setEdit(x)}>
            <CatIcon icon={x.icon} color={x.color || '#ff0080'} size={36} />
            <span className="grow">{nameOf(x, lang)}</span>
            {kind === 'book' && settings.bookId === x.id && <span className="check"><Icon name="check" size={18} /></span>}
            <span className="chev"><Icon name="chevR" size={16} /></span>
          </button>
        ))}
      </div>
      {edit && <NamedEditor kind={kind} item={edit.id ? edit : null} ctype={ctype} count={items.length} onClose={() => setEdit(null)} />}
    </Sheet>
  );
}

function NamedEditor({ kind, item, ctype, count, onClose }) {
  const t = useT(); const { settings, records } = useStore();
  const [name, setName] = useState(item ? nameOf(item, settings.lang) : '');
  const [icon, setIcon] = useState(item?.icon || (kind === 'book' ? '📒' : kind === 'member' ? '🙂' : '🛒'));
  const [color, setColor] = useState(item?.color || '#ff0080');
  const title = item ? t.edit : kind === 'book' ? t.newLedger : kind === 'member' ? t.newMember : t.newCategory;
  function save() {
    if (!name.trim()) return;
    const rec = store.put({ id: item?.id || uid(), kind, name: name.trim(), icon, color, order: item?.order ?? Date.now(), ...(kind === 'category' ? { type: item?.type || ctype } : {}) });
    if (kind === 'book' && !item) store.setSettings({ bookId: rec.id });
    onClose();
  }
  function del() {
    if (count <= 1) return;
    if (!confirmAsk(`${t.delete}?`)) return;
    store.remove(item.id);
    if (kind === 'book' && settings.bookId === item.id) store.setSettings({ bookId: live(records, 'book').find((b) => b.id !== item.id)?.id });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={title}
      actions={<>{item && count > 1 && <button className="text-btn danger" onClick={del}>{t.delete}</button>}<button className="text-btn strong" onClick={save}>{t.save}</button></>}>
      <div className="form">
        <label className="field"><span>{kind === 'book' ? t.ledgerName : kind === 'category' ? t.categoryName : t.member}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus /></label>
        <div className="field"><span>{t.icon}</span><IconPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} /></div>
        {kind === 'book' && item && settings.bookId !== item.id && (
          <button className="btn primary" onClick={() => { store.setSettings({ bookId: item.id }); onClose(); }}><Icon name="check" size={16} />{nameOf(item, settings.lang)}</button>
        )}
      </div>
    </Sheet>
  );
}

function BudgetSheet({ onClose }) {
  const t = useT(); const { records, settings } = useStore();
  const cur = live(records, 'budget').find((b) => b.bookId === settings.bookId);
  const [v, setV] = useState(cur ? String(cur.amount) : '');
  return (
    <Sheet open onClose={onClose} title={t.monthlyBudget}
      actions={<button className="text-btn strong" onClick={() => {
        const n = parseFloat(v);
        if (!n) { if (cur) store.remove(cur.id); } else store.put({ id: cur?.id || `budget-${settings.bookId}`, kind: 'budget', bookId: settings.bookId, amount: n, period: 'month', deleted: false });
        onClose();
      }}>{t.save}</button>}>
      <div className="form">
        <label className="field"><span>{t.budget} / {t.month}</span>
          <input inputMode="decimal" autoFocus value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" /></label>
      </div>
    </Sheet>
  );
}

export default function More({ installPrompt, onInstall }) {
  const t = useT(); const money = useMoney(); const { records, settings } = useStore(); const { cfg } = useSync();
  const [open, setOpen] = useState(null);
  const fileRef = useRef(null);
  const book = records[settings.bookId];
  const budget = live(records, 'budget').find((b) => b.bookId === settings.bookId);

  function exportCsv() {
    const rows = [['date', 'type', 'category', 'account', 'to_account', 'member', 'amount', 'note']];
    for (const b of live(records, 'bill').sort((a, c) => a.time - c.time)) {
      rows.push([new Date(b.time).toISOString(), b.type, b.type === 'transfer' ? '' : billTitle(b, records, settings.lang, t), nameOf(records[b.accountId], settings.lang),
        b.toAccountId ? nameOf(records[b.toAccountId], settings.lang) : '', nameOf(records[b.memberId], settings.lang), b.amount, b.note || '']);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    download(new Blob(['﻿' + csv], { type: 'text/csv' }), `kasku-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const Row = ({ icon, label, value, onClick }) => (
    <button className="row" onClick={onClick}><span className="row-ic"><Icon name={icon} size={18} /></span><span className="grow">{label}</span>
      {value != null && <span className="row-val">{value}</span>}<span className="chev"><Icon name="chevR" size={16} /></span></button>
  );

  return (
    <div className="page">
      <div className="hero compact profile">
        <Logo />
        <div><h1 className="hero-title">{t.appName}</h1><small>{cfg.session?.user?.email || t.tagline}</small></div>
      </div>

      <div className="card">
        <Row icon="cloud" label={t.syncTitle} value={<SyncBadge />} onClick={() => setOpen('sync')} />
      </div>

      <h3 className="sec-title">{t.ledger}</h3>
      <div className="card">
        <Row icon="ledger" label={t.myLedgers} value={nameOf(book, settings.lang)} onClick={() => setOpen('book')} />
        <Row icon="target" label={t.monthlyBudget} value={budget ? money(budget.amount) : '—'} onClick={() => setOpen('budget')} />
        <Row icon="tag" label={t.categories} onClick={() => setOpen('category')} />
        <Row icon="users" label={t.members} onClick={() => setOpen('member')} />
      </div>

      <h3 className="sec-title">{t.settings}</h3>
      <div className="card">
        <div className="row static"><span className="row-ic"><Icon name="drop" size={18} /></span><span className="grow">{t.theme}</span></div>
        <div className="color-row pad-x">
          {THEMES.map((c) => <button key={c} aria-label={c} className={`swatch ${settings.theme === c ? 'on' : ''}`} style={{ background: c }} onClick={() => store.setSettings({ theme: c })} />)}
        </div>
        <label className="row"><span className="row-ic"><Icon name="moon" size={18} /></span><span className="grow">{t.darkMode}</span>
          <input type="checkbox" className="switch" checked={settings.dark} onChange={(e) => store.setSettings({ dark: e.target.checked })} /></label>
        <label className="row"><span className="row-ic"><Icon name="globe" size={18} /></span><span className="grow">{t.language}</span>
          <select value={settings.lang} onChange={(e) => store.setSettings({ lang: e.target.value })}><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>
        <label className="row"><span className="row-ic"><Icon name="coin" size={18} /></span><span className="grow">{t.currency}</span>
          <select value={settings.currency} onChange={(e) => store.setSettings({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>

      <h3 className="sec-title">{t.backup}</h3>
      <div className="card">
        <Row icon="upload" label={t.exportBackup} onClick={() => download(backupBlob(), `kasku-backup-${new Date().toISOString().slice(0, 10)}.json`)} />
        <Row icon="download" label={t.importBackup} onClick={() => fileRef.current?.click()} />
        <Row icon="file" label={t.exportCsv} onClick={exportCsv} />
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f || !confirmAsk(t.restoreQ)) return;
          try { await restoreBackup(f); } catch { alert(t.badBackup); }
        }} />
      </div>

      <h3 className="sec-title">{t.install}</h3>
      <div className="card pad-card">
        <p className="hint">{t.installHint}</p>
        {installPrompt && <button className="btn primary" onClick={onInstall}>{t.installBtn}</button>}
      </div>

      <div className="card">
        <button className="row danger" onClick={() => { if (confirmAsk(t.resetQ)) store.resetAll(); }}><span className="row-ic"><Icon name="trash" size={18} /></span><span className="grow">{t.reset}</span></button>
      </div>
      <p className="foot">{t.appName} · v1.0</p>

      {open === 'sync' && <SyncSheet onClose={() => setOpen(null)} />}
      {open === 'budget' && <BudgetSheet onClose={() => setOpen(null)} />}
      {open === 'book' && <NamedListSheet kind="book" title={t.myLedgers} onClose={() => setOpen(null)} />}
      {open === 'category' && <NamedListSheet kind="category" title={t.categories} onClose={() => setOpen(null)} />}
      {open === 'member' && <NamedListSheet kind="member" title={t.members} onClose={() => setOpen(null)} />}
    </div>
  );
}
