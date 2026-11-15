import React, { useState } from 'react';
import { store, useStore, live, nameOf, uid } from './store.js';
import { useT, CatIcon, Icon, Sheet, Segmented, IconPicker, confirmAsk } from './ui.jsx';
import { useSync, configure, signIn, signOut, syncNow, SETUP_SQL } from './sync.js';


export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function SyncBadge() {
  const t = useT(); const { cfg, status } = useSync();
  const map = { off: t.notConnected, idle: t.synced, syncing: t.syncing, offline: t.offline, error: status.error || 'error' };
  return <span className={`sync-badge ${status.phase}`} title={cfg.session?.user?.email || ''}>{map[status.phase] || ''}</span>;
}

export function SyncSheet({ onClose }) {
  const t = useT(); const { cfg, status } = useSync(); const { settings } = useStore();
  const [url, setUrl] = useState(cfg.url); const [key, setKey] = useState(cfg.key);
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null); const [showSql, setShowSql] = useState(false);
  async function go(create) {
    setMsg(null);
    configure(url, key);
    try {
      const r = await signIn(email.trim(), pw, create);
      setMsg({ ok: r === 'confirm' ? (settings.lang === 'en' ? 'Check your email to confirm, then sign in.' : 'Cek email untuk konfirmasi, lalu masuk.') : t.signedIn });
    } catch (e) { setMsg({ err: e.message }); }
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
        {msg && <div className={msg.err ? 'err' : 'ok-msg'} role="status">{msg.err || msg.ok}</div>}
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
  const [icon, setIcon] = useState(item?.icon || (kind === 'book' ? '📒' : kind === 'member' ? '🙂' : '🛒'));
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

