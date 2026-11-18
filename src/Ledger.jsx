import React, { useMemo, useState } from 'react';
import { useStore, live, nameOf, firstDayOfWeek, formatMoney } from './store.js';
import { useT, useMoney, useBase, useTween, useLiveAnchor, useSlideDir, CatIcon, Icon, PeriodNav, Segmented, periodRange, dayKey, Sheet, Empty, Progress } from './ui.jsx';
import { mainBudget, parseNumber } from './logic.js';

export function billTitle(b, records, lang) {
  if (b.type === 'transfer') return `${nameOf(records[b.accountId], lang)} → ${nameOf(records[b.toAccountId], lang)}`;
  return nameOf(records[b.categoryId], lang);
}

export function BillRow({ b, onOpen }) {
  const { records, settings } = useStore();
  const lang = settings.lang;
  const c = b.type === 'transfer' ? { icon: <Icon name="swap" size={18} />, color: '#888888' } : records[b.categoryId] || { color: '#888888' };
  const acc = records[b.accountId];
  const tm = new Date(b.time);
  const sub = [`${String(tm.getHours()).padStart(2, '0')}:${String(tm.getMinutes()).padStart(2, '0')}`,
    b.type !== 'transfer' && acc ? nameOf(acc, lang) : '', b.note, ...(b.tags || []).map((x) => `#${x}`)].filter(Boolean).join(' · ');
  // "fresh": saved a moment ago (added/edited here, or just synced in) → brief highlight as confirmation.
  const fresh = Date.now() - (b.updatedAt || 0) < 1500;
  return (
    <button className={`bill${fresh ? ' fresh' : ''}`} data-id={b.id} onClick={() => onOpen(b)}>
      <CatIcon icon={c.icon} color={c.color} size={40} />
      <span className="bill-main">
        <span className="bill-title">{billTitle(b, records, lang)}</span>
        <span className="bill-sub">{sub}</span>
      </span>
      {b.hasPhoto && <span className="chev"><Icon name="camera" size={16} /></span>}
      {/* shown in the account's own currency; totals convert to the main currency */}
      <span className={`bill-amt ${b.type}`}>{b.type === 'expense' ? '-' : b.type === 'income' ? '+' : ''}{formatMoney(b.amount, acc?.currency || settings.currency, lang)}</span>
    </button>
  );
}

function sumOf(bills, base) {
  let exp = 0; let inc = 0;
  for (const b of bills) { if (b.type === 'expense') exp += base(b); else if (b.type === 'income') inc += base(b); }
  return { exp, inc };
}

export function DayList({ bills, onOpen, t }) {
  const money = useMoney(); const base = useBase();
  const groups = useMemo(() => {
    const m = new Map();
    for (const b of [...bills].sort((a, b2) => b2.time - a.time)) {
      const k = dayKey(b.time); if (!m.has(k)) m.set(k, []); m.get(k).push(b);
    }
    return [...m.entries()];
  }, [bills]);
  const todayK = dayKey(Date.now()); const yK = dayKey(Date.now() - 86400000);
  return <div className="stagger">{groups.map(([k, list]) => {
    const d = new Date(list[0].time); const s = sumOf(list, base);
    return (
      <section className="day" key={k}>
        <header className="day-head">
          <span className="day-num">{d.getDate()}</span>
          <span className="day-name">
            {k === todayK ? t.today : k === yK ? t.yesterday : t.weekdays[d.getDay()]}
            <small>{t.months[d.getMonth()].slice(0, 3)} {d.getFullYear()}</small>
          </span>
          <span className="day-sum">
            {s.inc > 0 && <span className="income">{t.incShort} {money(s.inc)}</span>}
            {s.exp > 0 && <span className="expense">{t.expShort} {money(s.exp)}</span>}
          </span>
        </header>
        <div className="card">{list.map((b) => <BillRow key={b.id} b={b} onOpen={onOpen} />)}</div>
      </section>
    );
  })}</div>;
}

// "Weekly pulse": same numbers and drawing rules as the original's medium home-screen
// widget (TodayWidgetMediumProvider.c builds the data, .a draws it). See MECHANICS.md.
const PULSE = { W: 400, H: 200, pad: 16, gap: 12, bottom: 30, minBar: 6, radius: 6 };
export function weeklyPulse(bills, now = Date.now(), base = (b) => b.amount) {
  const [ws] = periodRange('week', now);
  const vals = Array(7).fill(0);
  for (const b of bills) {
    if (b.type !== 'expense') continue;
    const d = new Date(b.time);
    const i = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - ws) / 86400000);
    if (i >= 0 && i < 7) vals[i] += base(b);
  }
  const t0 = new Date(now);
  const todayIdx = Math.round((new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()) - ws) / 86400000);
  return { ws, vals, todayIdx, today: vals[todayIdx] || 0, week: vals.reduce((a, v) => a + v, 0) };
}

function WeeklyPulse({ bills, t, lang }) {
  const money = useMoney(); const base = useBase();
  const p = weeklyPulse(bills, Date.now(), base);
  const { W, H, pad, gap, bottom, minBar, radius } = PULSE;
  const max = Math.max(1, ...p.vals);
  const baseY = H - bottom; const usable = baseY - pad;
  const bw = (W - 2 * pad - 6 * gap) / 7;
  const fmt = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'narrow' });
  const todayA = useTween(p.today); const weekA = useTween(p.week);
  return (
    <div className="pulse">
      <div className="pulse-top">
        <div><small>{t.today} · {t.expense}</small><b>{money(todayA, { whole: true })}</b></div>
        <div className="r"><small>{t.thisWeek}</small><b>{money(weekA, { whole: true })}</b></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.week}: ${money(p.week, { whole: true })}`}>
        {p.vals.map((v, i) => {
          const h = Math.max(minBar, usable * (v / max));
          const x = pad + i * (bw + gap);
          const isToday = i === p.todayIdx;
          const a = v > 0 ? (isToday ? 1 : 0xcc / 255) : 0x26 / 255;
          const day = new Date(p.ws.getFullYear(), p.ws.getMonth(), p.ws.getDate() + i);
          return (
            <g key={i}>
              <rect x={x} y={baseY - h} width={bw} height={h} rx={radius} fill="currentColor" fillOpacity={a} style={{ animationDelay: `${i * 15}ms` }} />
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fill="currentColor" fillOpacity={isToday ? 1 : 0.5} fontSize="16" fontWeight="600">{fmt.format(day)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Calendar({ anchor, bills, onOpen, onAddDay, t }) {
  const money = useMoney(); const base = useBase();
  const { settings } = useStore();
  const [sel, setSel] = useState(null);
  const d0 = new Date(anchor); const y = d0.getFullYear(); const m = d0.getMonth();
  const first = new Date(y, m, 1); const days = new Date(y, m + 1, 0).getDate();
  const fd = firstDayOfWeek(settings.lang);
  const lead = (first.getDay() - fd + 7) % 7;
  const heads = Array.from({ length: 7 }, (_, i) => t.weekdays[(i + fd) % 7]);
  const byDay = {};
  for (const b of bills) { const k = new Date(b.time).getDate(); (byDay[k] ||= []).push(b); }
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const todayK = dayKey(Date.now());
  const selBills = sel ? (byDay[sel] || []).sort((a, b) => b.time - a.time) : [];
  // The grid slides in from the side the user moved toward (M8): later months from the right.
  const mk = y * 12 + m; const dir = useSlideDir(mk);
  return (
    <div>
      <div key={mk} className={`cal card ${dir}`}>
        {heads.map((w) => <div key={w} className="cal-w">{w}</div>)}
        {cells.map((n, i) => {
          if (!n) return <div key={`e${i}`} />;
          const s = sumOf(byDay[n] || [], base);
          const isToday = dayKey(new Date(y, m, n)) === todayK;
          return (
            <button key={n} className={`cal-d ${sel === n ? 'on' : ''} ${isToday ? 'today' : ''}`} aria-pressed={sel === n} onClick={() => setSel(n)}>
              <span className="n">{n}</span>
              {s.inc > 0 && <span className="income">{money(s.inc, { compact: true })}</span>}
              {s.exp > 0 && <span className="expense">{money(s.exp, { compact: true })}</span>}
            </button>
          );
        })}
      </div>
      {sel && (
        <section className="day">
          <header className="day-head">
            <span className="day-num">{sel}</span>
            <span className="day-name">{t.weekdays[new Date(y, m, sel).getDay()]}<small>{t.months[m].slice(0, 3)} {y}</small></span>
            <button className="text-btn push" onClick={() => onAddDay(new Date(y, m, sel, 12).getTime())}><Icon name="plus" size={14} />{t.record}</button>
          </header>
          {selBills.length ? <div className="card">{selBills.map((b) => <BillRow key={b.id} b={b} onOpen={onOpen} />)}</div>
            : <Empty small title={t.noBillDay} />}
        </section>
      )}
    </div>
  );
}

export default function Ledger({ onOpenBill, onAddAt }) {
  const t = useT(); const money = useMoney(); const base = useBase();
  const { records, settings } = useStore();
  const [anchor, setAnchor] = useLiveAnchor();
  const [view, setView] = useState('detail');
  const viewDir = useSlideDir(view === 'detail' ? 0 : 1); // Detail ↔ Kalender slides toward the tab picked
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [s, e] = periodRange('month', anchor);
  const allBills = live(records, 'bill').filter((b) => (b.bookId || 'book-default') === settings.bookId);
  const bills = allBills.filter((b) => b.time >= s.getTime() && b.time < e.getTime());
  const { exp, inc } = sumOf(bills, base);
  const budget = mainBudget(records, settings.bookId);
  const left = budget ? budget.amount - exp : null;
  const expA = useTween(exp); const incA = useTween(inc); const balA = useTween(inc - exp); const leftA = useTween(Math.abs(left || 0));

  const results = useMemo(() => {
    const k = q.trim().toLowerCase(); if (!k) return [];
    // Amounts are read the way they are written: ">1.000" is more than a thousand, "25.000" finds 25000.
    const gt = k.startsWith('>'); const lt = k.startsWith('<');
    const bare = k.replace(/^[<>]\s*/, '');
    const num = /^(rp\.?\s*)?[\d.,]+$/.test(bare) ? parseNumber(bare) : NaN;
    return allBills.filter((b) => {
      if (gt && !Number.isNaN(num)) return b.amount > num;
      if (lt && !Number.isNaN(num)) return b.amount < num;
      if (!Number.isNaN(num) && String(b.amount).includes(String(num))) return true;
      const hay = [b.note, String(b.amount), billTitle(b, records, settings.lang), nameOf(records[b.accountId], settings.lang), ...(b.tags || []).map((x) => `#${x}`)].join(' ').toLowerCase();
      return hay.includes(k);
    });
  }, [q, allBills, records, settings.lang]);

  return (
    <div className="page wide">
      <div className="split">
        <div className="split-a">
          <div className="hero">
            <div className="hero-top">
              <PeriodNav unit="month" anchor={anchor} setAnchor={setAnchor} />
              <button className="icon-btn ring" aria-label={t.search} onClick={() => setSearchOpen(true)}><Icon name="search" size={18} /></button>
            </div>
            <div className="hero-label">{t.expense}</div>
            <div className="hero-big">{money(expA)}</div>
            <div className="hero-row">
              <span>{t.income} <b>{money(incA)}</b></span>
              <span>{t.balance} <b>{money(balA)}</b></span>
            </div>
            {budget && (
              <a className="hero-budget" href="#/anggaran">
                <div className="hb-top"><span>{left < 0 ? t.overBudget : t.budgetLeft}</span><b className={left < 0 ? 'neg' : ''}>{money(leftA)}</b></div>
                <Progress value={exp} max={budget.amount} over={left < 0} />
              </a>
            )}
          </div>
          <WeeklyPulse bills={allBills} t={t} lang={settings.lang} />
        </div>

        <div className="split-b">
          <div className="toolbar">
            <Segmented label={t.view} value={view} onChange={setView} options={[{ value: 'detail', label: t.details }, { value: 'calendar', label: t.calendar }]} />
          </div>
          <div key={view} className={viewDir}>
            {view === 'detail' ? (
              bills.length ? <DayList bills={bills} onOpen={onOpenBill} t={t} /> : <Empty title={t.noBill} hint={t.addFirst} />
            ) : <Calendar anchor={anchor} bills={bills} onOpen={onOpenBill} onAddDay={onAddAt} t={t} />}
          </div>
        </div>
      </div>

      <Sheet open={searchOpen} onClose={() => { setSearchOpen(false); setQ(''); }} title={t.search} full>
        <input className="search-in" autoFocus placeholder={t.searchHint} aria-label={t.search} value={q} onChange={(e2) => setQ(e2.target.value)} />
        {q && !results.length && <Empty small title={t.noResult} />}
        {results.length > 0 && <DayList bills={results} onOpen={(b) => { setSearchOpen(false); onOpenBill(b); }} t={t} />}
      </Sheet>
    </div>
  );
}
