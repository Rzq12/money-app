import React, { useState } from 'react';
import { store, useStore, live, nameOf, uid } from './store.js';
import { useT, CatIcon, Icon, Sheet, Segmented, IconPicker, confirmAsk } from './ui.jsx';
import { useSync, signIn, signUp, resetPassword, signOut, syncNow, configured } from './sync.js';
import { Logo } from './ui.jsx';

export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function SyncBadge() {
  const t = useT(); const { cfg, status } = useSync();
  const map = { off: t.notConnected, idle: status.pending ? t.unsent.replace('{n}', status.pending) : t.synced, syncing: t.syncing, offline: status.pending ? `${t.offline} · ${t.unsent.replace('{n}', status.pending)}` : t.offline, error: t.syncFailed };
  return <span className={`sync-badge ${status.phase}`} title={status.phase === 'error' ? status.error : cfg.session?.user?.email || ''}>{map[status.phase] || ''}</span>;
}

// Account and sync state for the signed-in user.
export function SyncSheet({ onClose }) {
  const t = useT(); const { cfg, status } = useSync();
  async function out() {
    const n = status.pending;
    if (n && !(await confirmAsk(t.signOutUnsent.replace('{n}', n), { danger: true, okLabel: t.signOut }))) return;
    await signOut(); onClose();
  }
  return (
    <Sheet open onClose={onClose} title={t.account} full>
      <div className="form">
        <div className="card pad-card">
          <div className="kv"><span>{t.email}</span><b>{cfg.session?.user?.email}</b></div>
          <div className="kv"><span>{t.sync}</span><SyncBadge /></div>
          <div className="kv"><span>{t.lastSync}</span><b>{cfg.lastSync ? new Date(cfg.lastSync).toLocaleString() : t.never}</b></div>
          {status.phase === 'error' && <p className="err" role="alert">{status.error}</p>}
          <div className="btn-row">
            <button className="btn primary" onClick={() => syncNow()} disabled={status.phase === 'syncing'}>{t.syncNow}</button>
            <button className="btn" onClick={out}>{t.signOut}</button>
          </div>
        </div>
        <p className="hint">{t.syncIntro}</p>
      </div>
    </Sheet>
  );
}

// Shown instead of the app until someone signs in.
export function AuthScreen() {
  const t = useT();
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const explain = (e) => (/invalid login|invalid_credentials/i.test(e.message) ? t.authBad
    : /not confirmed/i.test(e.message) ? t.authUnconfirmed
      : /already registered|already exists/i.test(e.message) ? t.authExists
        : e.status === 429 ? t.authTooMany : e.message);
  async function submit(e) {
    e.preventDefault(); setMsg(null);
    if (offline) return setMsg({ err: t.authOffline });
    if (mode !== 'reset' && pw.length < 8) return setMsg({ err: t.authShort });
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), pw);
      else if (mode === 'up') { if ((await signUp(email.trim(), pw)) === 'confirm') setMsg({ ok: t.authCheckMail }); }
      else { await resetPassword(email.trim()); setMsg({ ok: t.authResetSent }); }
    } catch (err) { setMsg({ err: explain(err) }); }
    setBusy(false);
  }
  if (!configured) {
    return <div className="auth"><div className="auth-card"><Logo /><h1>{t.appName}</h1><p className="err" role="alert">{t.notConfigured}</p></div></div>;
  }
  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>{mode === 'up' ? t.signUpTitle : mode === 'reset' ? t.resetTitle : t.signInTitle}</h1>
        <p className="hint">{mode === 'reset' ? t.resetIntro : t.authIntro}</p>
        <label className="field"><span>{t.email}</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus /></label>
        {mode !== 'reset' && <label className="field"><span>{t.password}</span><input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></label>}
        {msg && <p className={msg.err ? 'err' : 'ok-msg'} role={msg.err ? 'alert' : 'status'}>{msg.err || msg.ok}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? t.syncing : mode === 'up' ? t.signUp : mode === 'reset' ? t.resetSend : t.signIn}</button>
        <div className="auth-links">
          {mode !== 'in' && <button type="button" className="text-btn" onClick={() => { setMode('in'); setMsg(null); }}>{t.haveAccount}</button>}
          {mode !== 'up' && <button type="button" className="text-btn" onClick={() => { setMode('up'); setMsg(null); }}>{t.noAccount}</button>}
          {mode === 'in' && <button type="button" className="text-btn" onClick={() => { setMode('reset'); setMsg(null); }}>{t.forgot}</button>}
        </div>
      </form>
    </div>
  );
}

export function NamedListSheet({ kind, title, onClose }) {
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
  const [icon, setIcon] = useState(item?.icon || (kind === 'book' ? 'notebook' : kind === 'member' ? 'person' : 'cart'));
  const [color, setColor] = useState(item?.color || '#ff0080');
  const title = item ? t.edit : kind === 'book' ? t.newLedger : kind === 'member' ? t.newMember : t.newCategory;
  function save() {
    if (!name.trim()) return;
    const rec = store.put({ id: item?.id || uid(), kind, name: name.trim(), icon, color, order: item?.order ?? Date.now(), ...(kind === 'category' ? { type: item?.type || ctype } : {}) });
    if (kind === 'book' && !item) store.setSettings({ bookId: rec.id });
    onClose();
  }
  async function del() {
    if (count <= 1) return;
    if (!(await confirmAsk(`${t.delete}?`, { danger: true, okLabel: t.delete }))) return;
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

