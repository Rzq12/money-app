import React, { useMemo, useState } from 'react';
import { useStore, live, nameOf, firstDayOfWeek } from './store.js';
import { useT, useMoney, CatIcon, Icon, PeriodNav, Segmented, periodRange, dayKey, Sheet } from './ui.jsx';

export function billTitle(b, records, lang, t) {
  if (b.type === 'transfer') return `${nameOf(records[b.accountId], lang)} → ${nameOf(records[b.toAccountId], lang)}`;
  return nameOf(records[b.categoryId], lang);
}

export function BillRow({ b, onOpen }) {
  const { records, settings } = useStore();
  const t = useT(); const money = useMoney(); const lang = settings.lang;
  const c = b.type === 'transfer' ? { icon: <Icon name="swap" size={18} />, color: '#888888' } : records[b.categoryId] || { icon: '❔', color: '#888888' };
  const acc = records[b.accountId];
  const tm = new Date(b.time);
  return (
    <button className="bill" onClick={() => onOpen(b)}>
      <CatIcon icon={c.icon} color={c.color} size={40} />
      <span className="bill-main">
        <span className="bill-title">{billTitle(b, records, lang, t)}</span>
        <span className="bill-sub">
          {String(tm.getHours()).padStart(2, '0')}:{String(tm.getMinutes()).padStart(2, '0')}
          {b.type !== 'transfer' && acc ? ` · ${nameOf(acc, lang)}` : ''}
          {b.note ? ` · ${b.note}` : ''}
        </span>
      </span>
      <span className={`bill-amt ${b.type}`}>{b.type === 'expense' ? '-' : b.type === 'income' ? '+' : ''}{money(b.amount)}</span>
    </button>
  );
}

function sumOf(bills) {
  let exp = 0; let inc = 0;
  for (const b of bills) { if (b.type === 'expense') exp += b.amount; else if (b.type === 'income') inc += b.amount; }
  return { exp, inc };
}

function DayList({ bills, onOpen, t }) {
  const money = useMoney();
  const groups = useMemo(() => {
    const m = new Map();
    for (const b of [...bills].sort((a, b2) => b2.time - a.time)) {
      const k = dayKey(b.time); if (!m.has(k)) m.set(k, []); m.get(k).push(b);
    }
    return [...m.entries()];
  }, [bills]);
  const todayK = dayKey(Date.now()); const yK = dayKey(Date.now() - 86400000);
  return groups.map(([k, list]) => {
    const d = new Date(list[0].time); const s = sumOf(list);
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
  });
}

// "Weekly pulse": same numbers and drawing rules as the original's medium home-screen
// widget (TodayWidgetMediumProvider.c builds the data, .a draws it). See MECHANICS.md.
const PULSE = { W: 400, H: 200, pad: 16, gap: 12, bottom: 30, minBar: 6, radius: 6 };
export function weeklyPulse(bills, now = Date.now()) {
  const [ws] = periodRange('week', now);
  const vals = Array(7).fill(0);
  for (const b of bills) {
    if (b.type !== 'expense') continue;
    const d = new Date(b.time);
    const i = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - ws) / 86400000);
    if (i >= 0 && i < 7) vals[i] += b.amount;
  }
  const t0 = new Date(now);
  const todayIdx = Math.round((new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()) - ws) / 86400000);
  return { ws, vals, todayIdx, today: vals[todayIdx] || 0, week: vals.reduce((a, v) => a + v, 0) };
}

function WeeklyPulse({ bills, t, lang }) {
  const money = useMoney();
  const p = weeklyPulse(bills);
  const { W, H, pad, gap, bottom, minBar, radius } = PULSE;
  const max = Math.max(1, ...p.vals);
  const base = H - bottom; const usable = base - pad;
  const bw = (W - 2 * pad - 6 * gap) / 7;
  const fmt = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'narrow' });
  return (
    <div className="pulse">
      <div className="pulse-top">
        <div><small>{t.today} · {t.expense}</small><b>{money(p.today, { whole: true })}</b></div>
        <div className="r"><small>{t.thisWeek}</small><b>{money(p.week, { whole: true })}</b></div>
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
              <rect x={x} y={base - h} width={bw} height={h} rx={radius} fill="currentColor" fillOpacity={a} />
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fill="currentColor" fillOpacity={isToday ? 1 : 0.5} fontSize="16" fontWeight="600">{fmt.format(day)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Calendar({ anchor, bills, onOpen, onAddDay, t }) {
  const money = useMoney();
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
  return (
    <div>
      <div className="cal card">
        {heads.map((w) => <div key={w} className="cal-w">{w}</div>)}
        {cells.map((n, i) => {
          if (!n) return <div key={`e${i}`} />;
          const s = sumOf(byDay[n] || []);
          const isToday = dayKey(new Date(y, m, n)) === todayK;
          return (
            <button key={n} className={`cal-d ${sel === n ? 'on' : ''} ${isToday ? 'today' : ''}`} onClick={() => setSel(n)}>
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
            <button className="text-btn" onClick={() => onAddDay(new Date(y, m, sel, 12).getTime())}><Icon name="plus" size={14} />{t.add}</button>
          </header>
          {selBills.length ? <div className="card">{selBills.map((b) => <BillRow key={b.id} b={b} onOpen={onOpen} />)}</div>
            : <p className="empty small">{t.noBill}</p>}
        </section>
      )}
    </div>
  );
}

export default function Ledger({ onOpenBill, onAddAt }) {
  const t = useT(); const money = useMoney();
  const { records, settings } = useStore();
  const [anchor, setAnchor] = useState(() => Date.now());
  const [view, setView] = useState('detail');
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [s, e] = periodRange('month', anchor);
  const allBills = live(records, 'bill').filter((b) => (b.bookId || 'book-default') === settings.bookId);
  const bills = allBills.filter((b) => b.time >= s.getTime() && b.time < e.getTime());
  const { exp, inc } = sumOf(bills);
  const budget = live(records, 'budget').find((b) => b.bookId === settings.bookId);
  const left = budget ? budget.amount - exp : null;
  const pct = budget && budget.amount > 0 ? Math.min(100, (exp / budget.amount) * 100) : 0;

  const results = useMemo(() => {
    const k = q.trim().toLowerCase(); if (!k) return [];
    const num = parseFloat(k.replace(/[^0-9.]/g, ''));
    const gt = k.startsWith('>'); const lt = k.startsWith('<');
    return allBills.filter((b) => {
      if (gt && !Number.isNaN(num)) return b.amount > num;
      if (lt && !Number.isNaN(num)) return b.amount < num;
      const hay = [b.note, String(b.amount), billTitle(b, records, settings.lang, t), nameOf(records[b.accountId], settings.lang)].join(' ').toLowerCase();
      return hay.includes(k);
    });
  }, [q, allBills, records, settings.lang, t]);

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-top">
          <PeriodNav unit="month" anchor={anchor} setAnchor={setAnchor} light />
          <button className="icon-btn ring" aria-label={t.search} onClick={() => setSearchOpen(true)}><Icon name="search" size={18} /></button>
        </div>
        <div className="hero-label">{t.expense}</div>
        <div className="hero-big">{money(exp)}</div>
        <div className="hero-row">
          <span>{t.income} <b>{money(inc)}</b></span>
          <span>{t.balance} <b>{money(inc - exp)}</b></span>
        </div>
        {budget && (
          <div className="hero-budget">
            <div className="hb-top"><span>{t.budgetLeft}</span><b>{money(left)}</b></div>
            <div className={`bar ${left < 0 ? 'over' : ''}`}><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>

      <WeeklyPulse bills={allBills} t={t} lang={settings.lang} />

      <div className="toolbar">
        <Segmented value={view} onChange={setView} options={[{ value: 'detail', label: t.details }, { value: 'calendar', label: t.calendar }]} />
      </div>

      {view === 'detail' ? (
        bills.length ? <DayList bills={bills} onOpen={onOpenBill} t={t} /> : (
          <div className="empty">
            <div className="empty-art" aria-hidden="true"><Icon name="ledger" size={22} /></div>
            <p>{t.noBill}</p><small>{t.addFirst}</small>
          </div>
        )
      ) : <Calendar anchor={anchor} bills={bills} onOpen={onOpenBill} onAddDay={onAddAt} t={t} />}

      <Sheet open={searchOpen} onClose={() => { setSearchOpen(false); setQ(''); }} title={t.search} full>
        <input className="search-in" autoFocus placeholder={t.searchHint} value={q} onChange={(e2) => setQ(e2.target.value)} />
        {q && !results.length && <p className="empty small">{t.noResult}</p>}
        {results.length > 0 && <DayList bills={results} onOpen={(b) => { setSearchOpen(false); onOpenBill(b); }} t={t} />}
      </Sheet>
    </div>
  );
}
