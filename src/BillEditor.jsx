import React, { useEffect, useMemo, useRef, useState } from 'react';
import { store, useStore, live, nameOf, uid } from './store.js';
import { useT, CatIcon, Icon, Sheet, Segmented, confirmAsk } from './ui.jsx';
import { matchRule, parseQuick, compressImage, putPhoto, getPhoto, delPhoto, fromDateInput, hasRate } from './logic.js';
import { callAI, aiReason, context } from './ai.js';

function evalExpr(s) {
  const parts = s.match(/[+-]?[0-9.]+/g);
  if (!parts) return 0;
  return Math.round(parts.reduce((a, p) => a + (parseFloat(p) || 0), 0) * 100) / 100;
}
// The typed expression with thousands grouped, in the app language's style:
// "8999.5+1200" reads "8.999,5+1.200" in Indonesian and "8,999.5+1,200" in English.
// Only the display changes; the expression itself keeps plain digits and '.' decimals.
const decimalMark = (lang) => (lang === 'id' ? ',' : '.');
function formatExpr(s, lang) {
  const group = lang === 'id' ? '.' : ',';
  return s.replace(/[0-9.]+/g, (num) => {
    const [int, dec] = num.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    return dec === undefined ? grouped : grouped + decimalMark(lang) + dec;
  });
}
const toLocalInput = (ms) => {
  const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const Speech = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function BillEditor({ bill, onClose, defaultTime }) {
  const t = useT();
  const { records, settings } = useStore();
  const lang = settings.lang;
  const accounts = live(records, 'account').filter((a) => !a.archived);
  const members = live(records, 'member');
  const [type, setType] = useState(bill?.type || 'expense');
  const catType = type === 'income' ? 'income' : 'expense';
  const cats = useMemo(() => live(records, 'category').filter((c) => c.type === catType), [records, catType]);
  const [categoryId, setCategoryId] = useState(bill?.categoryId || null);
  const [manual, setManual] = useState(!!bill?.categoryId); // the user picked the category, so rules stop overriding it
  const [expr, setExpr] = useState(bill ? String(bill.amount) : '');
  const [note, setNote] = useState(bill?.note || '');
  const [tags, setTags] = useState((bill?.tags || []).join(' '));
  const [time, setTime] = useState(bill?.time || defaultTime || Date.now());
  const [accountId, setAccountId] = useState(bill?.accountId || settings.lastAccountId || accounts[0]?.id);
  const [toAccountId, setToAccountId] = useState(bill?.toAccountId || accounts.find((a) => a.id !== accountId)?.id);
  const [memberId, setMemberId] = useState(bill?.memberId || 'mem-me');
  const [photo, setPhoto] = useState(null); const [photoDirty, setPhotoDirty] = useState(false);
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState('');
  const [picker, setPicker] = useState(null); // 'account' | 'to' | 'member'
  const fileRef = useRef(null); const rec = useRef(null);
  const [aiNote, setAiNote] = useState(''); const [reading, setReading] = useState(false);
  const manualRef = useRef(manual); manualRef.current = manual;
  const suggest = useRef(null);
  useEffect(() => () => clearTimeout(suggest.current), []);

  useEffect(() => { if (bill?.hasPhoto) getPhoto(bill.id).then((u) => u && setPhoto(u)).catch(() => {}); }, [bill]);
  useEffect(() => () => rec.current?.abort?.(), []);

  const cat = records[categoryId] && records[categoryId].type === catType ? records[categoryId] : null;
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
  // Auto-category rules: a keyword in the note picks the category until the user picks one by hand.
  function changeNote(v) {
    setNote(v);
    if (manual || type === 'transfer') return;
    const c = matchRule(v, records, catType);
    if (c) { setCategoryId(c.id); return; }
    // No rule matched: ask AI once the user stops typing; a category picked by hand always wins.
    clearTimeout(suggest.current);
    if (v.trim().length < 3) return;
    suggest.current = setTimeout(async () => {
      try {
        const { ids } = await callAI('categorize', { notes: [{ note: v.trim(), type: catType }], categories: context().categories });
        if (ids[0] && !manualRef.current) { setCategoryId(ids[0]); setAiNote(t.aiSuggested); }
      } catch { /* keyword fallback already applied */ }
    }, 600);
  }
  async function readReceipt() {
    setErr(''); setReading(true);
    try {
      const r = await callAI('receipt', { image: photo, ...context() });
      if (!r.readable) { setErr(t.receiptUnreadable); return; }
      setType('expense'); setExpr(String(r.total));
      if (r.merchant) setNote(r.merchant);
      if (r.date) { const d = new Date(time); setTime(fromDateInput(r.date, d.getHours()) + d.getMinutes() * 60000); }
      if (r.categoryId && !manualRef.current) setCategoryId(r.categoryId);
      setAiNote(t.receiptFilled);
    } catch (e) { setErr(aiReason(t, e)); } finally { setReading(false); }
  }
  async function onPhoto(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setPhoto(await compressImage(f)); setPhotoDirty(true); } catch { setErr(t.photoErr); }
  }
  function listen() {
    if (listening) return rec.current?.stop();
    const r = new Speech(); rec.current = r;
    r.lang = lang === 'id' ? 'id-ID' : 'en-US'; r.interimResults = false;
    r.onresult = (e) => {
      const said = e.results[0][0].transcript;
      const p = parseQuick(said, records);
      if (!p) { setNote(said); return setErr(t.voiceNoAmount); }
      setErr(''); setType(p.type); setExpr(String(p.amount)); setNote(p.note);
      if (p.category) { setCategoryId(p.category.id); setManual(p.how !== 'fallback'); }
    };
    r.onerror = (e) => setErr(e.error === 'not-allowed' ? t.voiceDenied : t.voiceErr);
    r.onend = () => setListening(false);
    setErr(''); setListening(true); r.start();
  }

  function save() {
    // "5-10" is worked out first; a negative result says so instead of a plain "enter an amount".
    if (hasOp) { if (amount < 0) return setErr(t.exprNegative); setExpr(String(amount)); return; }
    if (!(amount > 0)) return setErr(t.enterAmount);
    if (type !== 'transfer' && !cat) return setErr(t.pickCategory);
    if (type === 'transfer' && (!toAccountId || !records[toAccountId] || records[toAccountId].deleted)) return setErr(t.needToAccount);
    if (type === 'transfer' && accountId === toAccountId) return setErr(t.sameAccount);
    if (type === 'transfer' && records[accountId]?.currency !== records[toAccountId]?.currency) {
      const miss = [records[accountId]?.currency, records[toAccountId]?.currency].find((c) => !hasRate(records, c, settings.currency));
      if (miss) return setErr(t.needRate.replace('{code}', miss));
    }
    const id = bill?.id || uid();
    const saved = store.put({
      id, kind: 'bill', type, amount, note: note.trim(), time,
      bookId: bill?.bookId || settings.bookId, accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? null : cat.id, memberId,
      tags: [...new Set(tags.split(/[,\s#]+/).filter(Boolean))].slice(0, 6), hasPhoto: !!photo,
      createdAt: bill?.createdAt || Date.now(),
    });
    if (!saved) return; // storage full: the sheet stays open with the entry, a notice explains why
    if (photoDirty) (photo ? putPhoto(id, photo) : delPhoto(id)).catch(() => {});
    store.setSettings({ lastAccountId: accountId });
    onClose();
  }

  async function del() {
    if (!(await confirmAsk(t.deleteBillQ, { danger: true, okLabel: t.delete }))) return;
    store.remove(bill.id); delPhoto(bill.id).catch(() => {}); onClose();
  }

  const acc = records[accountId]; const toAcc = records[toAccountId]; const mem = records[memberId];
  const keys = ['7', '8', '9', 'date', '4', '5', '6', '+', '1', '2', '3', '-', '.', '0', 'del', 'ok'];

  return (
    <Sheet open onClose={onClose} full title={bill ? t.edit : t.record}
      actions={bill && <button className="text-btn danger" onClick={del}>{t.delete}</button>}>
      <div className="editor">
        <Segmented label={t.type} value={type} onChange={(v) => { setType(v); setErr(''); }}
          options={[{ value: 'expense', label: t.expShort }, { value: 'income', label: t.incShort }, { value: 'transfer', label: t.transfer }]} />

        {type !== 'transfer' ? (
          <div className="cat-grid" role="radiogroup" aria-label={t.category}>
            {cats.map((c) => (
              <button key={c.id} role="radio" aria-checked={cat?.id === c.id} className={`cat-cell ${cat?.id === c.id ? 'on' : ''}`} onClick={() => { setCategoryId(c.id); setManual(true); setErr(''); }}>
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
            <button className="swap" aria-label={t.swapAcc} onClick={() => { setAccountId(toAccountId); setToAccountId(accountId); }}><Icon name="swap" size={18} /></button>
            <button className="transfer-acc" onClick={() => setPicker('to')}>
              <small>{t.to}</small><CatIcon icon={toAcc?.icon} color={toAcc?.color} size={36} /><b>{nameOf(toAcc, lang)}</b>
            </button>
          </div>
        )}

        <div className="pad">
          <div className="amount-row">
            {type !== 'transfer' && cat ? <CatIcon icon={cat.icon} color={cat.color} size={34} /> : <span className="caticon ph"><Icon name={type === 'transfer' ? 'swap' : 'question'} size={16} /></span>}
            <input className="note-in" placeholder={t.notePh} aria-label={t.note} value={note} onChange={(e) => changeNote(e.target.value)} maxLength={120} />
            <span className={`amount ${type}`} aria-live="polite">{expr ? formatExpr(expr, lang) : '0'}</span>
          </div>
          {err && <div className="err" role="alert">{err}</div>}
          {aiNote && !err && <div className="hint ai-note" role="status"><span className="ai-tag">{t.aiLabel}</span>{aiNote}</div>}
          {photo && (
            <div className="photo">
              <a href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={t.receipt} /></a>
              <span className="hint grow">{t.photoLocal}</span>
              <button className="text-btn" disabled={reading} onClick={readReceipt}><Icon name="receipt" size={14} />{reading ? t.receiptReading : t.receiptRead}</button>
              <button className="text-btn danger" onClick={() => { setPhoto(null); setPhotoDirty(true); }}>{t.delete}</button>
            </div>
          )}
          <div className="chips">
            <label className="chip">
              <Icon name="calendar" size={14} /><input type="datetime-local" aria-label={t.date} value={toLocalInput(time)} onChange={(e) => e.target.value && setTime(new Date(e.target.value).getTime())} />
            </label>
            {type !== 'transfer' && <button className="chip" onClick={() => setPicker('account')}><Icon name={acc?.icon} size={14} />{nameOf(acc, lang)}</button>}
            <button className="chip" onClick={() => setPicker('member')}><Icon name={mem?.icon} size={14} />{nameOf(mem, lang)}</button>
            <label className="chip"><Icon name="tag" size={14} /><input className="tag-in" value={tags} placeholder={t.tagsPh} aria-label={t.tags} maxLength={60} onChange={(e) => setTags(e.target.value)} /></label>
            <button className="chip" onClick={() => fileRef.current?.click()}><Icon name="camera" size={14} />{photo ? t.photoChange : t.photoAdd}</button>
            {Speech && <button className={`chip ${listening ? 'on' : ''}`} aria-pressed={listening} onClick={listen}><Icon name="mic" size={14} />{listening ? t.voiceStop : t.voice}</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          </div>
          <div className="keys">
            {keys.map((k) => {
              if (k === 'date') return <button key={k} className="key fn" onClick={() => setTime(Date.now())}>{t.today}</button>;
              if (k === 'ok') return <button key={k} className="key ok" onClick={save}>{hasOp ? '=' : t.done}</button>;
              if (k === 'del') return <button key={k} className="key fn" aria-label={t.backspace} onClick={() => press('del')}><Icon name="backspace" /></button>;
              return <button key={k} className={`key ${k === '+' || k === '-' ? 'fn' : ''}`} onClick={() => press(k)}>{k === '.' ? decimalMark(lang) : k}</button>;
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
              <CatIcon icon={x.icon} color={x.color} size={34} /><span className="grow">{nameOf(x, lang)}</span>
              {((picker === 'member' && x.id === memberId) || (picker === 'to' && x.id === toAccountId) || (picker === 'account' && x.id === accountId)) && <span className="check"><Icon name="check" size={18} /></span>}
            </button>
          ))}
        </div>
      </Sheet>
    </Sheet>
  );
}
