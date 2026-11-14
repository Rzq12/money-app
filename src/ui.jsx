import React, { createContext, useContext, useEffect } from 'react';
import { dict } from './i18n.js';
import { useStore, formatMoney, firstDayOfWeek, store } from './store.js';

export const LangCtx = createContext('id');
export function useT() {
  const lang = useContext(LangCtx);
  return dict[lang] || dict.id;
}
export function useMoney() {
  const { settings } = useStore();
  return (n, opts) => formatMoney(n, settings.currency, settings.lang, opts);
}

// One drawn icon set: 24px grid, 1.5px stroke, round caps. Category emoji stay as user content.
const ICONS = {
  ledger: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  analysis: <path d="M5 20v-8M12 20V5M19 20v-11M3 20h18" />,
  wallet: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3" /><path d="M3 7.5V17a2.5 2.5 0 0 0 2.5 2.5H21V8H5.5A2.5 2.5 0 0 1 3 7.5Z" /><circle cx="16.5" cy="13.75" r=".9" fill="currentColor" /></>,
  more: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevL: <path d="M14.5 6l-6 6 6 6" />,
  chevR: <path d="M9.5 6l6 6-6 6" />,
  chevD: <path d="M6 9.5l6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  cloud: <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a4 4 0 0 1-.5 8H7Z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  tag: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.3 7.3a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-7.3-7.3a1 1 0 0 1-.3-.7Z" /><circle cx="8" cy="8" r="1.2" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.8c2.1.6 3.5 2.4 3.5 5.2" /></>,
  drop: <path d="M12 3.5s6 6 6 10.5a6 6 0 0 1-12 0c0-4.5 6-10.5 6-10.5Z" />,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M12 6.8v10.4M14.8 9.5c-.5-.9-1.6-1.3-2.8-1.3-1.6 0-2.9.8-2.9 2 0 2.7 5.8 1.3 5.8 4 0 1.2-1.3 2-2.9 2-1.3 0-2.4-.5-2.9-1.3" /></>,
  upload: <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />,
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />,
  file: <path d="M6.5 3.5H14l4 4v12.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM14 3.5v4h4M9 13h6M9 16.5h6" />,
  trash: <path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l.8 13h9.4l.8-13M10 10.5V16M14 10.5V16" />,
  swap: <path d="M7 8h13M16.5 4.5L20 8l-3.5 3.5M17 16H4M7.5 12.5L4 16l3.5 3.5" />,
  backspace: <path d="M9 5.5h10.5a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9L3 12l6-6.5ZM12 9.5l5 5M17 9.5l-5 5" />,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};
export function Icon({ name, size = 20 }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  );
}
export function Logo({ small }) {
  const s = small ? 18 : 30;
  return (
    <span className={`logo-mark ${small ? 'sm' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 4v16M16 8c-.7-1.3-2.2-2-4-2-2.2 0-4 1.2-4 3 0 4 8 2 8 6 0 1.8-1.8 3-4 3-1.8 0-3.3-.7-4-2" />
      </svg>
    </span>
  );
}

export function CatIcon({ icon, color = '#888888', size = 40 }) {
  return (
    <span className="caticon" style={{ width: size, height: size, background: color + '33', fontSize: size * 0.52 }}>
      <span aria-hidden="true">{icon}</span>
    </span>
  );
}

export function Sheet({ open, onClose, title, children, actions, full }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon name="close" /></button>
          <h2>{title}</h2>
          <div className="sheet-actions">{actions}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Segmented({ value, onChange, options, light }) {
  return (
    <div className={`seg ${light ? 'seg-light' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// Period helpers: unit = 'week' | 'month' | 'year'
export function periodRange(unit, anchor) {
  const d = new Date(anchor);
  if (unit === 'year') return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear() + 1, 0, 1)];
  if (unit === 'week') {
    // Week starts on the locale's first weekday at 00:00 (TodayWidgetMediumProvider.d).
    const fd = firstDayOfWeek(store.get().settings.lang);
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() - fd + 7) % 7));
    return [s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7)];
  }
  return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)];
}
export function shiftPeriod(unit, anchor, dir) {
  const d = new Date(anchor);
  if (unit === 'year') return new Date(d.getFullYear() + dir, d.getMonth(), 1).getTime();
  if (unit === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * dir).getTime();
  return new Date(d.getFullYear(), d.getMonth() + dir, 1).getTime();
}
export function periodLabel(unit, anchor, t) {
  const [s, e] = periodRange(unit, anchor);
  if (unit === 'year') return String(s.getFullYear());
  if (unit === 'week') {
    const end = new Date(e.getTime() - 86400000);
    return `${s.getDate()} ${t.months[s.getMonth()].slice(0, 3)} – ${end.getDate()} ${t.months[end.getMonth()].slice(0, 3)}`;
  }
  return `${t.months[s.getMonth()]} ${s.getFullYear()}`;
}

export function PeriodNav({ unit, anchor, setAnchor, light }) {
  const t = useT();
  return (
    <div className={`period ${light ? 'light' : ''}`}>
      <button className="icon-btn" aria-label="Sebelumnya" onClick={() => setAnchor(shiftPeriod(unit, anchor, -1))}><Icon name="chevL" /></button>
      <span className="period-label">{periodLabel(unit, anchor, t)}</span>
      <button className="icon-btn" aria-label="Berikutnya" onClick={() => setAnchor(shiftPeriod(unit, anchor, 1))}><Icon name="chevR" /></button>
    </div>
  );
}

export const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const EMOJIS = ['🍜', '🍔', '🍰', '☕', '🍺', '🛒', '🧴', '🚌', '🚕', '⛽', '🚗', '🏠', '💡', '💧', '📱', '💻', '👕', '👟', '💄', '💊', '🏥', '📚', '🎓', '🍼', '🐱', '🐶', '✈️', '🏖️', '🎮', '🎬', '🎵', '⚽', '🎁', '💐', '🧾', '🔧', '🌱', '💰', '🏅', '📈', '💼', '🪙', '💵', '💳', '🏦', '📲', '🐷', '💎', '❤️', '⭐'];
// Data colours come from the design system's gradient pairs and semantic scale.
export const COLORS = ['#0070f3', '#00dfd8', '#50e3c2', '#29bc9b', '#7928ca', '#ff0080', '#eb367f', '#ff4d4d', '#f5a623', '#f9cb28', '#888888'];

export function IconPicker({ icon, color, onIcon, onColor }) {
  return (
    <div className="picker">
      <div className="emoji-grid">
        {EMOJIS.map((e) => (
          <button key={e} type="button" className={`emoji ${icon === e ? 'on' : ''}`} onClick={() => onIcon(e)}
            style={icon === e ? { background: color + '44' } : undefined}>{e}</button>
        ))}
      </div>
      {onColor && (
        <div className="color-row">
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onColor(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function confirmAsk(msg) { return window.confirm(msg); }
