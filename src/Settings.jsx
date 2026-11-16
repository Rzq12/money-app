// The "Lainnya" menu and the settings page (general, wallets, currencies).
import React, { useState } from 'react';
import { store, useStore, live, nameOf, CURRENCIES, ACCENTS } from './store.js';
import { useT, Icon, Logo, Segmented, PageHead, confirmAsk, go } from './ui.jsx';
import { useSync } from './sync.js';
import { SyncBadge, SyncSheet, NamedListSheet } from './More.jsx';
import { hasRate } from './logic.js';
import { useAi, setAiOff } from './ai.js';
import { num } from './Money.jsx';
import Wallet from './Wallet.jsx';
import { NAV } from './App.jsx';

export function Hub() {
  const t = useT(); const { cfg } = useSync();
  return (
    <div className="page">
      <div className="hero compact profile mesh">
        <Logo />
        <div><h1 className="hero-title">{t.appName}</h1><small>{cfg.session?.user?.email || t.tagline}</small></div>
      </div>
      {NAV.map((group, i) => {
        const items = group.filter(([p]) => p !== '' && p !== 'laporan');
        return (
          <div key={i} className="card">
            {items.map(([p, icon, key]) => (
              <a key={p} className="row" href={`#/${p}`}>
                <span className="row-ic"><Icon name={icon} size={18} /></span><span className="grow">{t[key]}</span>
                <span className="chev"><Icon name="chevR" size={16} /></span>
              </a>
            ))}
          </div>
        );
      })}
      <p className="foot">{t.appName} · v1.1</p>
    </div>
  );
}

function Rates() {
  const t = useT(); const { records, settings } = useStore(); const base = settings.currency;
  const used = [...new Set([...live(records, 'account').map((a) => a.currency), ...live(records, 'rate').map((r) => r.code)])].filter((c) => c && c !== base);
  const [code, setCode] = useState('');
  const free = CURRENCIES.filter((c) => c !== base && !used.includes(c));
  const setRate = (c, v) => store.put({ id: `rate-${c}`, kind: 'rate', code: c, rate: num(v), deleted: false });
  return (
    <>
      <div className="card">
        <label className="row"><span className="row-ic"><Icon name="coin" size={18} /></span><span className="grow">{t.baseCurrency}</span>
          <select value={base} onChange={(e) => store.setSettings({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <p className="hint gut">{t.ratesHint.replace('{base}', base)}</p>
      <h2 className="sec-title">{t.ratesTitle}</h2>
      {!used.length ? <p className="empty small">{t.ratesEmpty}</p> : (
        <div className="card">
          {used.map((c) => (
            <label key={c} className="row">
              <span className="grow">1 {c} ={!hasRate(records, c, base) && <small className="neg"> {t.rateMissing}</small>}</span>
              <input className="rate-in" inputMode="decimal" aria-label={`1 ${c} = ? ${base}`} defaultValue={records[`rate-${c}`]?.rate || ''} placeholder="0"
                onBlur={(e) => setRate(c, e.target.value)} onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9.,]/g, ''); }} />
              <span className="row-val">{base}</span>
            </label>
          ))}
        </div>
      )}
      {free.length > 0 && (
        <div className="inline-add gut">
          <select value={code} onChange={(e) => setCode(e.target.value)} aria-label={t.rateAdd}><option value="">{t.rateAdd}</option>{free.map((c) => <option key={c}>{c}</option>)}</select>
          <button className="btn" disabled={!code} onClick={() => { store.put({ id: `rate-${code}`, kind: 'rate', code, rate: 0, deleted: false }); setCode(''); }}>{t.add}</button>
        </div>
      )}
    </>
  );
}

function General({ installPrompt, onInstall }) {
  const t = useT(); const { records, settings } = useStore(); const ai = useAi();
  const [open, setOpen] = useState(null);
  const Row = ({ icon, label, value, onClick }) => (
    <button className="row" onClick={onClick}><span className="row-ic"><Icon name={icon} size={18} /></span><span className="grow">{label}</span>
      {value != null && <span className="row-val">{value}</span>}<span className="chev"><Icon name="chevR" size={16} /></span></button>
  );
  return (
    <>
      <div className="card"><Row icon="cloud" label={t.account} value={<SyncBadge />} onClick={() => setOpen('sync')} /></div>

      <h2 className="sec-title">{t.ledger}</h2>
      <div className="card">
        <Row icon="ledger" label={t.myLedgers} value={nameOf(records[settings.bookId], settings.lang)} onClick={() => setOpen('book')} />
        <Row icon="tag" label={t.categories} onClick={() => setOpen('category')} />
        <Row icon="users" label={t.members} onClick={() => setOpen('member')} />
      </div>

      <h2 className="sec-title">{t.display}</h2>
      <div className="card">
        <div className="row static"><span className="row-ic"><Icon name="drop" size={18} /></span><span className="grow">{t.theme}</span></div>
        <div className="color-row pad-x" role="radiogroup" aria-label={t.theme}>
          {ACCENTS.map((c) => <button key={c} role="radio" aria-checked={settings.theme === c} aria-label={c} className={`swatch ${settings.theme === c ? 'on' : ''}`} style={{ background: c }} onClick={() => store.setSettings({ theme: c })} />)}
        </div>
        <label className="row"><span className="row-ic"><Icon name="moon" size={18} /></span><span className="grow">{t.darkMode}</span>
          <input type="checkbox" className="switch" checked={settings.dark} onChange={(e) => store.setSettings({ dark: e.target.checked })} /></label>
        <label className="row"><span className="row-ic"><Icon name="globe" size={18} /></span><span className="grow">{t.language}</span>
          <select value={settings.lang} onChange={(e) => store.setSettings({ lang: e.target.value })}><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>
      </div>

      <h2 className="sec-title">{t.aiTitle}</h2>
      <div className="card">
        <label className="row"><span className="row-ic"><Icon name="chat" size={18} /></span><span className="grow">{t.aiUse}</span>
          <input type="checkbox" className="switch" checked={!ai.off} onChange={(e) => setAiOff(!e.target.checked)} /></label>
        <div className="pad-card">
          {ai.configured === false && <p className="err">{t.aiErr.not_configured}</p>}
          {ai.remaining != null && !ai.off && <p className="hint">{t.aiLeft.replace('{n}', ai.remaining)}</p>}
          <p className="hint">{t.aiSendsIntro}</p>
          <ul className="ai-sends">{t.aiSends.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>

      <h2 className="sec-title">{t.install}</h2>
      <div className="card pad-card">
        <p className="hint">{t.installHint}</p>
        {installPrompt && <div className="btn-row"><button className="btn primary" onClick={onInstall}>{t.installBtn}</button></div>}
      </div>

      <div className="card gap">
        <button className="row danger" onClick={async () => { if (await confirmAsk(t.resetQ, { danger: true, okLabel: t.reset })) store.resetAll(); }}>
          <span className="row-ic"><Icon name="trash" size={18} /></span><span className="grow">{t.reset}</span></button>
      </div>

      {open === 'sync' && <SyncSheet onClose={() => setOpen(null)} />}
      {open === 'book' && <NamedListSheet kind="book" title={t.myLedgers} onClose={() => setOpen(null)} />}
      {open === 'category' && <NamedListSheet kind="category" title={t.categories} onClose={() => setOpen(null)} />}
      {open === 'member' && <NamedListSheet kind="member" title={t.members} onClose={() => setOpen(null)} />}
    </>
  );
}

export function Settings({ tab, onOpenBill, installPrompt, onInstall }) {
  const t = useT();
  const tabs = [{ value: 'umum', label: t.general }, { value: 'dompet', label: t.wallet }, { value: 'mata-uang', label: t.rates }];
  const cur = tabs.some((x) => x.value === tab) ? tab : 'umum';
  return (
    <div className="page">
      <PageHead title={t.settings} />
      <div className="toolbar start"><Segmented label={t.settings} value={cur} onChange={(v) => go(`pengaturan?tab=${v}`)} options={tabs} /></div>
      {cur === 'umum' && <General installPrompt={installPrompt} onInstall={onInstall} />}
      {cur === 'dompet' && <Wallet onOpenBill={onOpenBill} />}
      {cur === 'mata-uang' && <Rates />}
    </div>
  );
}
