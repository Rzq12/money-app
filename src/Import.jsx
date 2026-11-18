// Import from CSV / XLSX / pasted notification text, duplicate clean-up, and backup.
import React, { useMemo, useRef, useState } from 'react';
import { store, useStore, live, nameOf, uid, formatMoney } from './store.js';
import { useT, Icon, PageHead, Empty, confirmAsk, notify } from './ui.jsx';
import { parseCsv, readXlsx, rowsToCandidates, parseNotifText, findDuplicates, looseKey } from './logic.js';
import { backupBlob, restoreBackup } from './sync.js';
import { download } from './More.jsx';
import { callAI, context } from './ai.js';
import { billTitle } from './Ledger.jsx';

// Local wall-clock time, as the user saw it when recording ("2026-11-18 00:30").
const localStamp = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const dateText = (ms, lang) => new Date(ms).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export function ImportPage() {
  const t = useT(); const { records, settings } = useStore(); const lang = settings.lang;
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [cands, setCands] = useState(null); // [{...bill fields, on, dup}]
  const [info, setInfo] = useState(null); // {ok} | {err}
  // Each preview gets a run number; AI answers for an older preview (imported or cancelled) are dropped.
  const run = useRef(0);
  const bills = useMemo(() => live(records, 'bill').filter((b) => (b.bookId || 'book-default') === settings.bookId), [records, settings.bookId]);
  const groups = useMemo(() => findDuplicates(bills), [bills]);

  async function show({ list, skipped }, source) {
    const me = ++run.current;
    const seen = new Set(bills.map(looseKey));
    const rows = list.filter((c) => c.categoryId && c.accountId && c.amount > 0).map((c, k) => {
      const lk = looseKey(c); const dup = seen.has(lk); seen.add(lk);
      return { ...c, key: k, dup, on: !dup };
    });
    setCands(rows.length ? rows : null);
    setInfo(rows.length ? { ok: t.impFound.replace('{n}', rows.length).replace('{s}', skipped + list.length - rows.length) } : { err: source === 'text' ? t.impNoText : t.impNoRows });
    // Rows no rule or name explained go to AI in batches of 50; a failure keeps the default category.
    // Answers only change the category of rows still on screen, never the user's ticks.
    const guessed = rows.filter((c) => c.guessed);
    for (let i = 0; i < guessed.length; i += 50) {
      const part = guessed.slice(i, i + 50);
      let ids;
      try { ({ ids } = await callAI('categorize', { notes: part.map((c) => ({ note: c.note, type: c.type })), categories: context().categories })); } catch { break; }
      if (run.current !== me) return;
      const byKey = new Map(part.map((c, j) => [c.key, ids[j]]));
      setCands((list2) => list2 && list2.map((c) => (byKey.get(c.key) ? { ...c, categoryId: byKey.get(c.key), ai: true } : c)));
    }
  }
  async function onFile(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const name = f.name.toLowerCase();
      if (name.endsWith('.xls')) return setInfo({ err: t.impXls });
      const rows = name.endsWith('.xlsx') ? readXlsx(await f.arrayBuffer()) : parseCsv(await f.text());
      show(rowsToCandidates(rows, records, settings), 'file');
    } catch { setCands(null); setInfo({ err: t.impBadFile }); }
  }
  function doImport() {
    const now = Date.now(); const picked = cands.filter((c) => c.on);
    run.current++;
    if (!store.putMany(picked.map(({ on, dup, guessed, ai, key, ...c }) => ({ ...c, id: uid(), kind: 'bill', bookId: settings.bookId, memberId: 'mem-me', toAccountId: null, createdAt: now })))) return;
    setCands(null); setText(''); setInfo({ ok: t.impDone.replace('{n}', picked.length) });
  }
  async function clean(group) {
    const extra = group.slice(1);
    if (!(await confirmAsk(t.dupAsk.replace('{n}', extra.length), { danger: true, okLabel: t.delete }))) return;
    store.putMany(extra.map((b) => ({ id: b.id, deleted: true })));
  }
  const picked = cands ? cands.filter((c) => c.on).length : 0;

  return (
    <div className="page">
      <PageHead title={t.import} sub={t.impSub} />
      <div className="card pad-card">
        <p className="hint">{t.impFileHint}</p>
        <div className="btn-row"><button className="btn primary" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />{t.impPick}</button></div>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onFile} />
      </div>
      <div className="card pad-card">
        <label className="field"><span>{t.impPaste}</span>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.impPastePh} /></label>
        <div className="btn-row"><button className="btn" disabled={!text.trim()} onClick={() => show(parseNotifText(text, records, settings), 'text')}>{t.impRead}</button></div>
      </div>
      {/* keyed by the message so a new result replays its icon: a drawn check, or a short shake (M30, M31) */}
      {info && <p key={info.err || info.ok} className={`${info.err ? 'err' : 'ok-msg'} gut status-line`} role="status">
        <span className={`st-ic ${info.err ? 'bad' : 'good'}`} aria-hidden="true"><Icon name={info.err ? 'alert' : 'check'} size={14} /></span>{info.err || info.ok}</p>}

      {cands && (
        <section>
          <h2 className="sec-title">{t.impPreview}</h2>
          <div className="card">
            {cands.map((c) => (
              <label key={c.key} className="bill">
                <input type="checkbox" className="check-in" checked={c.on} onChange={(e) => { const on = e.target.checked; setCands((list2) => list2.map((x) => (x.key === c.key ? { ...x, on } : x))); }} />
                <span className="bill-main">
                  <span className="bill-title">{c.note || nameOf(records[c.categoryId], lang)}</span>
                  <span className="bill-sub">{dateText(c.time, lang)} · {nameOf(records[c.categoryId], lang)} · {nameOf(records[c.accountId], lang)}{c.dup ? ` · ${t.impDup}` : ''}{c.ai ? ` · ${t.impAiCat}` : ''}</span>
                </span>
                <span className={`bill-amt ${c.type}`}>{c.type === 'expense' ? '-' : '+'}{formatMoney(c.amount, records[c.accountId]?.currency || settings.currency, lang)}</span>
              </label>
            ))}
          </div>
          <div className="btn-row gut"><button className="btn primary" disabled={!picked} onClick={doImport}>{t.impDo.replace('{n}', picked)}</button>
            <button className="btn" onClick={() => { run.current++; setCands(null); setInfo(null); }}>{t.cancel}</button></div>
        </section>
      )}

      <h2 className="sec-title">{t.dupTitle}</h2>
      {!groups.length ? <Empty small title={t.dupNone} /> : (
        <div className="card">
          {groups.map((g) => (
            <div key={g[0].id} className="bill">
              <span className="bill-main">
                <span className="bill-title">{g[0].note || billTitle(g[0], records, lang, t)} × {g.length}</span>
                <span className="bill-sub">{dateText(g[0].time, lang)} · {nameOf(records[g[0].accountId], lang)} · {formatMoney(g[0].amount, records[g[0].accountId]?.currency || settings.currency, lang)}</span>
              </span>
              <button className="btn sm" onClick={() => clean(g)}>{t.dupClean.replace('{n}', g.length - 1)}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BackupPage() {
  const t = useT(); const { records, settings } = useStore();
  const fileRef = useRef(null);
  const stamp = new Date().toISOString().slice(0, 10);
  function exportCsv() {
    const rows = [['date', 'type', 'category', 'account', 'to_account', 'member', 'amount', 'note', 'tags']];
    for (const b of live(records, 'bill').sort((a, c) => a.time - c.time)) {
      rows.push([localStamp(b.time), b.type, b.type === 'transfer' ? '' : billTitle(b, records, settings.lang, t), nameOf(records[b.accountId], settings.lang),
        b.toAccountId ? nameOf(records[b.toAccountId], settings.lang) : '', nameOf(records[b.memberId], settings.lang), b.amount, b.note || '', (b.tags || []).join(' ')]);
    }
    // Text starting with = + - @ would run as a formula in a spreadsheet; a leading ' keeps it text.
    const cell = (c) => { const v = typeof c === 'string' && /^[=+\-@\t\r]/.test(c) ? `'${c}` : String(c); return `"${v.replace(/"/g, '""')}"`; };
    const csv = rows.map((r) => r.map(cell).join(',')).join('\n');
    download(new Blob(['﻿' + csv], { type: 'text/csv' }), `kasku-${stamp}.csv`);
  }
  const Row = ({ icon, label, hint, onClick }) => (
    <button className="row tall" onClick={onClick}><span className="row-ic"><Icon name={icon} size={18} /></span>
      <span className="bill-main"><span className="bill-title">{label}</span><span className="bill-sub wrap">{hint}</span></span></button>
  );
  return (
    <div className="page">
      <PageHead title={t.backup} sub={t.backupSub} />
      <div className="card">
        <Row icon="download" label={t.exportBackup} hint={t.exportBackupHint} onClick={async () => download(await backupBlob(), `kasku-backup-${stamp}.json`)} />
        <Row icon="upload" label={t.importBackup} hint={t.importBackupHint} onClick={() => fileRef.current?.click()} />
        <Row icon="file" label={t.exportCsv} hint={t.exportCsvHint} onClick={exportCsv} />
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f || !(await confirmAsk(t.restoreQ))) return;
          try { await restoreBackup(f); notify(t.restoreDone); } catch { notify(t.badBackup); }
        }} />
      </div>
    </div>
  );
}
