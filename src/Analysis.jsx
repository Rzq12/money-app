import React, { useMemo, useState } from 'react';
import { useStore, live, nameOf } from './store.js';
import { useT, useMoney, useBase, CatIcon, PeriodNav, Segmented, periodRange, Empty } from './ui.jsx';

const PALETTE = ['#0070f3', '#7928ca', '#ff0080', '#f5a623', '#00dfd8', '#ff4d4d', '#29bc9b', '#eb367f', '#f9cb28', '#888888', '#ab570a', '#4c2889'];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const tooClose = (a, b) => { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 70; };

function Donut({ parts, total, label, money }) {
  const R = 78; const C = 2 * Math.PI * R;
  let off = 0;
  return (
    <svg viewBox="0 0 200 200" className="donut" role="img" aria-label={`${label}: ${money(total)}`}>
      <circle cx="100" cy="100" r={R} fill="none" stroke="var(--track)" strokeWidth="14" />
      {parts.map((p) => {
        const len = (p.value / total) * C;
        const el = (
          <circle key={p.key} cx="100" cy="100" r={R} fill="none" stroke={p.color} strokeWidth="14"
            strokeDasharray={`${Math.max(len - 2, 0.01)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 100 100)" />
        );
        off += len; return el;
      })}
      <text x="100" y="94" textAnchor="middle" className="donut-l">{label}</text>
      <text x="100" y="116" textAnchor="middle" className="donut-v">{money(total, { compact: true })}</text>
    </svg>
  );
}

export default function Analysis() {
  const t = useT(); const money = useMoney(); const base = useBase(); const { records, settings } = useStore(); const lang = settings.lang;
  const [unit, setUnit] = useState('month');
  const [anchor, setAnchor] = useState(() => Date.now());
  const [kind, setKind] = useState('expense');
  const [dim, setDim] = useState('category');
  const [s, e] = periodRange(unit, anchor);
  const bills = live(records, 'bill').filter((b) => (b.bookId || 'book-default') === settings.bookId && b.type === kind && b.time >= s.getTime() && b.time < e.getTime());
  const total = bills.reduce((a, b) => a + base(b), 0);
  const days = Math.max(1, Math.round((Math.min(e.getTime(), Date.now()) - s.getTime()) / 86400000) || 1);

  const parts = useMemo(() => {
    const m = new Map();
    for (const b of bills) {
      const key = dim === 'category' ? b.categoryId : dim === 'account' ? b.accountId : b.memberId;
      const cur = m.get(key) || { key, value: 0, n: 0 }; cur.value += base(b); cur.n += 1; m.set(key, cur);
    }
    // Slices keep their own colour unless it is too close to one already in the chart.
    const used = [];
    return [...m.values()].sort((a, b) => b.value - a.value).map((p) => {
      const r = records[p.key];
      let color = (dim !== 'member' && r?.color) || null;
      if (!color || used.some((u) => tooClose(u, color))) color = PALETTE.find((c) => !used.some((u) => tooClose(u, c))) || '#888888';
      used.push(color);
      return { ...p, name: nameOf(r, lang), icon: r?.icon, color };
    });
  }, [bills, dim, records, lang]);

  const trend = useMemo(() => {
    const buckets = [];
    if (unit === 'year') for (let i = 0; i < 12; i++) buckets.push({ label: t.months[i].slice(0, 3), v: 0 });
    else {
      const n = Math.round((e - s) / 86400000);
      for (let i = 0; i < n; i++) { const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i); buckets.push({ label: unit === 'week' ? t.weekdays[d.getDay()] : String(d.getDate()), v: 0 }); }
    }
    for (const b of bills) {
      const d = new Date(b.time);
      const i = unit === 'year' ? d.getMonth() : Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - s) / 86400000);
      if (buckets[i]) buckets[i].v += base(b);
    }
    return buckets;
  }, [bills, unit, s, e, t]);
  const maxV = Math.max(1, ...trend.map((x) => x.v));
  const kindLabel = kind === 'expense' ? t.expense : t.income;

  return (
    <div className="page wide">
      <div className="hero compact">
        <div className="hero-top"><h1 className="hero-title">{t.analysis}</h1>
          <Segmented label={t.period} value={unit} onChange={setUnit} options={[{ value: 'week', label: t.week }, { value: 'month', label: t.month }, { value: 'year', label: t.year }]} /></div>
        <PeriodNav unit={unit} anchor={anchor} setAnchor={setAnchor} />
      </div>
      <div className="toolbar">
        <Segmented label={t.type} value={kind} onChange={setKind} options={[{ value: 'expense', label: t.expense }, { value: 'income', label: t.income }]} />
      </div>

      {!bills.length ? <Empty icon="analysis" title={t.noData.replace('{kind}', kindLabel.toLowerCase())} hint={t.noDataHint} /> : (
        <>
          <div className="stats card">
            <div><small>{t.total}</small><b>{money(total)}</b></div>
            <div><small>{t.dailyAvg}</small><b>{money(total / days)}</b></div>
            <div><small>{t.count}</small><b>{bills.length}</b></div>
          </div>

          <div className="split even">
            <div className="split-a">
              <h2 className="sec-title">{t.share}</h2>
              <div className="card chart-card"><Donut parts={parts} total={total} label={kindLabel} money={money} /></div>
              <h2 className="sec-title">{t.trend}</h2>
              <div className="card trend">
                <div className="trend-bars" role="img" aria-label={`${t.trend}: ${kindLabel}`}>
                  {trend.map((x, i) => (
                    <div key={i} className="tb" title={`${x.label}: ${money(x.v)}`}>
                      <i className={kind} style={{ height: `${(x.v / maxV) * 100}%` }} />
                      <span>{trend.length > 12 && i % 5 !== 0 && i !== trend.length - 1 ? '' : x.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="split-b">
              <div className="toolbar start">
                <Segmented label={t.groupBy} value={dim} onChange={setDim} options={[{ value: 'category', label: t.category }, { value: 'account', label: t.account }, { value: 'member', label: t.member }]} />
              </div>
              <div className="card">
                {parts.map((p) => (
                  <div key={p.key} className="rank">
                    <CatIcon icon={p.icon} color={p.color} size={36} />
                    <div className="rank-main">
                      <div className="rank-top"><span>{p.name} <small>{p.n}×</small></span><b>{money(p.value)}</b></div>
                      <div className="bar"><i style={{ width: `${(p.value / total) * 100}%`, background: p.color }} /></div>
                    </div>
                    <span className="pct">{((p.value / total) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
