import React, { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { LangCtx, useT, Icon, Logo } from './ui.jsx';
import Ledger from './Ledger.jsx';
import Analysis from './Analysis.jsx';
import Wallet from './Wallet.jsx';
import More, { SyncBadge } from './More.jsx';
import BillEditor from './BillEditor.jsx';

const TABS = [{ id: 'ledger' }, { id: 'analysis' }, { id: 'wallet' }, { id: 'more' }];

// Text colour for a custom accent: whichever of white or ink contrasts more.
function onColor(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0585 ? '#ffffff' : '#171717';
}

function Shell() {
  const t = useT();
  const { settings } = useStore();
  const [tab, setTab] = useState(() => (location.hash.replace('#', '') || 'ledger'));
  const [editor, setEditor] = useState(null); // {bill?, time?}
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => { if (location.hash.replace('#', '') !== tab) history.replaceState(null, '', `#${tab}`); }, [tab]);
  useEffect(() => {
    const h = () => { const v = location.hash.replace('#', ''); if (TABS.some((x) => x.id === v)) setTab(v); };
    window.addEventListener('hashchange', h);
    const p = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', p);
    return () => { window.removeEventListener('hashchange', h); window.removeEventListener('beforeinstallprompt', p); };
  }, []);
  useEffect(() => {
    const r = document.documentElement;
    // Ink is the default primary and flips with dark mode in CSS; other accents override it.
    if (settings.theme === '#171717') { r.style.removeProperty('--primary'); r.style.removeProperty('--on-primary'); }
    else { r.style.setProperty('--primary', settings.theme); r.style.setProperty('--on-primary', onColor(settings.theme)); }
    r.dataset.theme = settings.dark ? 'dark' : 'light';
    r.lang = settings.lang;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.dark ? '#000000' : '#fafafa');
  }, [settings.theme, settings.dark, settings.lang]);

  const label = { ledger: t.ledger, analysis: t.analysis, wallet: t.wallet, more: t.more };
  const openBill = (b) => setEditor({ bill: b });
  const add = () => setEditor({});

  const nav = (cls) => (
    <nav className={cls} aria-label="Navigasi">
      {cls === 'side' && (
        <div className="brand"><Logo small /><b>{t.appName}</b></div>
      )}
      {TABS.slice(0, 2).map((x) => (
        <button key={x.id} className={tab === x.id ? 'on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => setTab(x.id)}>
          <Icon name={x.id} size={cls === 'side' ? 18 : 22} /><span>{label[x.id]}</span>
        </button>
      ))}
      <button className="fab" aria-label={t.add} onClick={add}><Icon name="plus" size={cls === 'side' ? 16 : 24} />{cls === 'side' && <span className="fab-l">{t.add}</span>}</button>
      {TABS.slice(2).map((x) => (
        <button key={x.id} className={tab === x.id ? 'on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => setTab(x.id)}>
          <Icon name={x.id} size={cls === 'side' ? 18 : 22} /><span>{label[x.id]}</span>
        </button>
      ))}
      {cls === 'side' && <div className="side-sync"><SyncBadge /></div>}
    </nav>
  );

  return (
    <div className="app">
      {nav('side')}
      <main className="main">
        {tab === 'ledger' && <Ledger onOpenBill={openBill} onAddAt={(time) => setEditor({ time })} />}
        {tab === 'analysis' && <Analysis />}
        {tab === 'wallet' && <Wallet onOpenBill={openBill} />}
        {tab === 'more' && <More installPrompt={installPrompt} onInstall={async () => { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }} />}
      </main>
      {nav('bottom')}
      {editor && <BillEditor bill={editor.bill} defaultTime={editor.time} onClose={() => setEditor(null)} />}
    </div>
  );
}

export default function App() {
  const { settings } = useStore();
  return <LangCtx.Provider value={settings.lang}><Shell /></LangCtx.Provider>;
}
