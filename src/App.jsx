import React, { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { LangCtx, useT, Icon, Logo, ConfirmHost } from './ui.jsx';
import { runRecurring } from './logic.js';
import Ledger from './Ledger.jsx';
import Analysis from './Analysis.jsx';
import { SyncBadge } from './More.jsx';
import BillEditor from './BillEditor.jsx';
import { Budgets, Goals, Debts, Recurring, Rules } from './Money.jsx';
import { Portfolio, Split, Chat, Kpr, Pph } from './Tools.jsx';
import { ImportPage, BackupPage } from './Import.jsx';
import { Settings, Hub } from './Settings.jsx';

// [path, icon, label key]. One inner array per block of the sidebar and of the "Lainnya" menu.
export const NAV = [
  [['', 'ledger', 'ledger'], ['laporan', 'analysis', 'analysis'], ['anggaran', 'target', 'budget'], ['tujuan', 'flag', 'goals'], ['portofolio', 'trend', 'portfolio'], ['debt', 'swapV', 'debts']],
  [['berulang', 'repeat', 'recurring'], ['aturan', 'filter', 'rules'], ['split', 'receipt', 'split'], ['chat', 'chat', 'chat'], ['import', 'inbox', 'import']],
  [['tools/kalkulator-kpr', 'home', 'kpr'], ['tools/kalkulator-pajak', 'percent', 'pph']],
  [['pengaturan', 'more', 'settings'], ['backup', 'archive', 'backup']],
];
const LEGACY = { ledger: '', analysis: 'laporan', wallet: 'pengaturan?tab=dompet', more: 'lainnya' };
function readRoute() {
  let h = location.hash.replace(/^#\/?/, '');
  if (h in LEGACY) { h = LEGACY[h]; history.replaceState(null, '', `#/${h}`); }
  const [path, q = ''] = h.split('?');
  return { path, tab: new URLSearchParams(q).get('tab') };
}

// Text colour for the accent: whichever of white or ink contrasts more.
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
  const [route, setRoute] = useState(readRoute);
  const [editor, setEditor] = useState(null); // {bill?, time?}
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const h = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    const p = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', p);
    // Recurring bills that came due while the app was closed or in the background.
    const due = () => { if (!document.hidden) runRecurring(); };
    due(); document.addEventListener('visibilitychange', due);
    return () => { window.removeEventListener('hashchange', h); window.removeEventListener('beforeinstallprompt', p); document.removeEventListener('visibilitychange', due); };
  }, []);
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', settings.theme);
    r.style.setProperty('--on-accent', onColor(settings.theme));
    r.dataset.theme = settings.dark ? 'dark' : 'light';
    r.lang = settings.lang;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.dark ? '#000000' : '#fafafa');
  }, [settings.theme, settings.dark, settings.lang]);

  const openBill = (b) => setEditor({ bill: b });
  const add = () => setEditor({});
  const { path, tab } = route;
  const link = (p, icon, key, size, on = path === p) => (
    <a key={p} href={`#/${p}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
      <Icon name={icon} size={size} /><span>{t[key]}</span>
    </a>
  );

  let page;
  if (path === 'laporan') page = <Analysis />;
  else if (path === 'anggaran') page = <Budgets />;
  else if (path === 'tujuan') page = <Goals />;
  else if (path === 'portofolio') page = <Portfolio />;
  else if (path === 'debt') page = <Debts />;
  else if (path === 'berulang') page = <Recurring />;
  else if (path === 'aturan') page = <Rules />;
  else if (path === 'split') page = <Split />;
  else if (path === 'chat') page = <Chat onOpenBill={openBill} />;
  else if (path === 'import') page = <ImportPage />;
  else if (path === 'backup') page = <BackupPage />;
  else if (path === 'tools/kalkulator-kpr') page = <Kpr />;
  else if (path === 'tools/kalkulator-pajak') page = <Pph />;
  else if (path === 'pengaturan') page = <Settings tab={tab || 'umum'} onOpenBill={openBill} installPrompt={installPrompt} onInstall={async () => { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }} />;
  else if (path === 'lainnya') page = <Hub />;
  else page = <Ledger onOpenBill={openBill} onAddAt={(time) => setEditor({ time })} />;

  const walletOn = path === 'pengaturan' && tab === 'dompet';
  return (
    <div className="app">
      <nav className="side" aria-label={t.nav}>
        <a className="brand" href="#/"><Logo small /><b>{t.appName}</b></a>
        <button className="fab" onClick={add}><Icon name="plus" size={16} /><span>{t.record}</span></button>
        <div className="side-scroll">
          {NAV.map((group, i) => <div key={i} className="side-g">{group.map(([p, icon, key]) => link(p, icon, key, 18))}</div>)}
        </div>
        <div className="side-sync"><SyncBadge /></div>
      </nav>
      <main className="main">{page}</main>
      <nav className="bottom" aria-label={t.nav}>
        {link('', 'ledger', 'ledger', 22)}
        {link('laporan', 'analysis', 'analysis', 22)}
        <button className="fab" aria-label={t.record} onClick={add}><Icon name="plus" size={24} /></button>
        {link('pengaturan?tab=dompet', 'wallet', 'wallet', 22, walletOn)}
        {link('lainnya', 'grid', 'more', 22, !['', 'laporan'].includes(path) && !walletOn)}
      </nav>
      {editor && <BillEditor bill={editor.bill} defaultTime={editor.time} onClose={() => setEditor(null)} />}
      <ConfirmHost />
    </div>
  );
}

export default function App() {
  const { settings } = useStore();
  return <LangCtx.Provider value={settings.lang}><Shell /></LangCtx.Provider>;
}
