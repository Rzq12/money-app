import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dict } from './i18n.js';
import { useStore, formatMoney, firstDayOfWeek, store } from './store.js';
import { billBase, dayKeyOf } from './logic.js';

// The period anchor of a screen that opens on "now". Until the user moves to another period it follows
// the clock, so "today" and "this month" roll over at midnight even while the app stays open.
export function useLiveAnchor() {
  const [st, setSt] = useState(() => ({ at: Date.now(), follow: true }));
  useEffect(() => {
    if (!st.follow) return undefined;
    const check = () => { const now = Date.now(); if (dayKeyOf(now) !== dayKeyOf(st.at)) setSt({ at: now, follow: true }); };
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, [st]);
  const set = useCallback((v) => setSt((s) => {
    const at = typeof v === 'function' ? v(s.at) : v;
    return { at, follow: dayKeyOf(at) === dayKeyOf(Date.now()) };
  }), []);
  return [st.at, set];
}
import { pushDialog } from './native.js';
import { iconShapes, iconName, iconsByGroup, ICON_GROUPS, DEFAULT_ICONS } from './icons.js';

export const LangCtx = createContext('id');
export function useT() {
  const lang = useContext(LangCtx);
  return dict[lang] || dict.id;
}
// Counts a number up to its new value (from 0 on first render) so a changed total is noticed.
// Display only: callers still use the real value everywhere else. Instant under reduced motion.
export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Plays a list row's exit (M9) and then runs `done`, which removes the record. Rows that are not on
// screen, and reduced motion, skip straight to `done`.
export function leave(id, done) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (!el || reduceMotion()) { done(); return; }
  el.style.height = `${el.offsetHeight}px`; // a fixed start height, so the collapse can animate
  el.classList.add('leaving');
  // Animations pause while the app is in the background; the timer makes sure the delete still lands.
  let ran = false; const once = () => { if (!ran) { ran = true; done(); } };
  el.addEventListener('animationend', once, { once: true });
  setTimeout(once, 400);
}
export function useTween(value, ms = 400) {
  const [shown, setShown] = useState(() => (reduceMotion() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (reduceMotion() || from.current === value) { from.current = value; setShown(value); return undefined; }
    const a = from.current; const t0 = performance.now(); let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms); const k = 1 - (1 - p) ** 3; // ease-out cubic
      const v = p < 1 ? Math.round(a + (value - a) * k) : value;
      from.current = v; setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
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
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  flag: <path d="M5 21V4M5 4.5h11l-2 4 2 4H5" />,
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  swapV: <path d="M7 20V4M3.5 7.5L7 4l3.5 3.5M17 4v16M13.5 16.5L17 20l3.5-3.5" />,
  repeat: <path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" />,
  filter: <path d="M4 5h16l-6 7.5v6l-4-2v-4L4 5Z" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6" />,
  chat: <path d="M5 4.5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />,
  inbox: <path d="M4 13l2.5-8h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5ZM4 13h5l1 2.5h4l1-2.5h5" />,
  archive: <path d="M4 5h16v4H4zM5.5 9v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9M10 13h4" />,
  home: <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-6h4v6" />,
  percent: <><path d="M6 18L18 6" /><circle cx="7.5" cy="7.5" r="2" /><circle cx="16.5" cy="16.5" r="2" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></>,
  camera: <><path d="M4 8a1 1 0 0 1 1-1h2.5l1.5-2h6l1.5 2H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" /><circle cx="12" cy="13" r="3.5" /></>,
  send: <path d="M4 12l16-7-6 16-3-7-7-2Z" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.3v.200" /></>,
};
// Record icons (src/icons.js) are stored as shape tuples; draw them with the same stroke as above.
function Shapes({ list }) {
  return list.map((s, i) => {
    if (s[0] === 'p') return <path key={i} d={s[1]} />;
    if (s[0] === 'c') return <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />;
    if (s[0] === 'r') return <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />;
    return <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} fill="currentColor" stroke="none" />;
  });
}

// Interface icons first, then record icons; anything else (unknown key, old emoji) gets the fallback.
export function Icon({ name, size = 20 }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || <Shapes list={iconShapes(name)} />}
    </svg>
  );
}
export { iconName, iconsByGroup, ICON_GROUPS, DEFAULT_ICONS };
export function Logo({ small }) {
  const s = small ? 18 : 30;
  return (
    <span className={`logo-mark ${small ? 'sm' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6v12M6.5 12.5l6-6.5M9 10l5 8" />
        <path d="M18 4.5v5M15.5 7h5" stroke="var(--accent)" />
      </svg>
    </span>
  );
}

// A record's icon on a tile tinted with its colour. `icon` is a key from the drawn set, or a ready
// element (the transfer arrows). Unknown values and old emoji draw the fallback icon, never text.
export function CatIcon({ icon, color = '#888888', size = 40 }) {
  return (
    <span className="caticon" style={{ width: size, height: size, background: color + '33' }}>
      {React.isValidElement(icon) ? icon : <Icon name={typeof icon === 'string' ? icon : ''} size={Math.round(size * 0.5)} />}
    </span>
  );
}

// Keeps keyboard focus inside a dialog while it is open and hands it back on close.
// Escape closes only the top-most dialog, because the handler sits on the dialog itself.
function useDialogFocus(open, onClose) {
  const ref = useRef(null); const close = useRef(onClose); close.current = onClose;
  // Remember the opener during render: by the time the effect runs, an autofocused field
  // inside the dialog has already taken focus.
  const opener = useRef(null);
  if (open && !opener.current) opener.current = document.activeElement;
  useEffect(() => {
    if (!open) return undefined;
    const el = ref.current; const prev = opener.current; opener.current = null;
    if (!el.contains(document.activeElement)) el.focus();
    const k = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current?.(); return; }
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll('button, [href], input, select, textarea')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === el)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    el.addEventListener('keydown', k);
    const unBack = pushDialog(() => close.current?.()); // Android back button
    return () => { el.removeEventListener('keydown', k); unBack(); prev?.focus?.(); };
  }, [open]);
  return ref;
}

// Drag the sheet's header down to dismiss it, on phones where the sheet sits at the bottom (M16).
// Past 30% of its height, or with a quick flick, it closes; otherwise it springs back.
function useSheetDrag(ref, dismiss) {
  const d = useRef(null);
  const start = (e) => {
    if (e.pointerType === 'mouse' || e.target.closest('button, a, input') || matchMedia('(min-width: 640px)').matches) return;
    d.current = { y: e.clientY, t: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    ref.current.style.transition = 'none';
  };
  const move = (e) => {
    if (!d.current) return;
    const el = ref.current; const dy = Math.max(0, e.clientY - d.current.y); d.current.dy = dy;
    el.style.transform = `translateY(${dy}px)`;
    el.parentElement.style.backgroundColor = `rgba(0, 0, 0, ${0.4 * (1 - Math.min(1, dy / el.offsetHeight))})`;
  };
  const end = (e) => {
    const s = d.current; if (!s) return;
    d.current = null;
    const el = ref.current;
    el.style.transition = '';
    const flick = s.dy > 24 && s.dy / (e.timeStamp - s.t) > 0.5; // faster than 0.5px per ms
    if (s.dy > el.offsetHeight * 0.3 || flick) { el.style.setProperty('--drop', '100%'); dismiss(); return; }
    el.style.transform = ''; el.parentElement.style.backgroundColor = '';
  };
  return { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end };
}

// A close the sheet starts itself (✕, backdrop, Escape, back button, drag) plays the exit first (M15).
// A close the content asks for, like saving, is immediate, so recording never waits on an animation.
export function Sheet({ open, onClose, title, children, actions, full }) {
  const t = useT();
  const [out, setOut] = useState(false);
  const dismiss = () => { if (out) return; if (reduceMotion()) onClose?.(); else setOut(true); };
  useEffect(() => { if (!open) setOut(false); }, [open]);
  const ref = useDialogFocus(open, dismiss);
  const drag = useSheetDrag(ref, dismiss);
  if (!open) return null;
  return (
    <div className={`sheet-wrap ${out ? 'out' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && dismiss()}
      onAnimationEnd={(e) => { if (out && e.target === e.currentTarget) { setOut(false); onClose?.(); } }}>
      <div ref={ref} tabIndex={-1} className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head" {...drag}>
          <button className="icon-btn" onClick={dismiss} aria-label={t.close}><Icon name="close" /></button>
          <h2>{title}</h2>
          <div className="sheet-actions">{actions}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// In-app confirmation, used instead of the browser's own confirm/alert boxes.
let ask = null;
export function confirmAsk(msg, opts = {}) {
  return new Promise((res) => (ask ? ask({ msg, ...opts, res }) : res(window.confirm(msg))));
}
export const notify = (msg) => confirmAsk(msg, { info: true });
export function ConfirmHost() {
  const t = useT(); const [q, setQ] = useState(null); const [out, setOut] = useState(false);
  const n = useRef(0); // each question gets its own dialog element, so its entrance always plays
  useEffect(() => { ask = (x) => { setOut(false); setQ({ ...x, n: ++n.current }); }; return () => { ask = null; }; }, []);
  // The answer goes back at once; the dialog only finishes its exit afterwards (M17).
  const done = (v) => { if (!q || out) return; q.res(v); if (reduceMotion()) setQ(null); else setOut(true); };
  const ref = useDialogFocus(!!q, () => done(false));
  if (!q) return null;
  return (
    <div key={q.n} className={`sheet-wrap center top ${out ? 'out' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && done(false)}
      onAnimationEnd={(e) => { if (out && e.target === e.currentTarget) { setOut(false); setQ(null); } }}>
      <div ref={ref} tabIndex={-1} className="dialog" role="alertdialog" aria-modal="true" aria-label={q.msg}>
        <p>{q.msg}</p>
        <div className="btn-row end">
          {!q.info && <button className="btn" onClick={() => done(false)}>{t.cancel}</button>}
          <button className={`btn ${q.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => done(true)}>{q.info ? t.ok : q.okLabel || t.yes}</button>
        </div>
      </div>
    </div>
  );
}

// One choice out of a few: a radio group, moved with the arrow keys.
export function Segmented({ value, onChange, options, label }) {
  const move = (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = (options.findIndex((o) => o.value === value) + d + options.length) % options.length;
    onChange(options[i].value);
    e.currentTarget.querySelectorAll('button')[i]?.focus();
  };
  // One indicator slides under the chosen option (M33). It is measured from the buttons, and again when
  // they resize (web font loaded, language changed), so it always fits the label.
  const ref = useRef(null); const [box, setBox] = useState(null);
  const labels = options.map((o) => o.label).join('|');
  useLayoutEffect(() => {
    const el = ref.current;
    const measure = () => {
      const b = el.querySelector('[aria-checked="true"]');
      if (b) setBox((o) => (o && o.x === b.offsetLeft && o.w === b.offsetWidth ? o : { x: b.offsetLeft, w: b.offsetWidth }));
    };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined; // test runner (jsdom)
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [value, labels]);
  return (
    <div ref={ref} className={`seg ${box ? 'slide' : ''}`} role="radiogroup" aria-label={label} onKeyDown={move}>
      {box && <i className="seg-i" style={{ width: box.w, transform: `translateX(${box.x}px)` }} aria-hidden="true" />}
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} tabIndex={value === o.value ? 0 : -1}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export const go = (path) => { location.hash = `#/${path}`; };

// Page header for the feature pages. The back link only shows on phones, where there is no sidebar.
export function PageHead({ title, sub, action, back = true }) {
  const t = useT();
  return (
    <header className="hero compact">
      <div className="hero-top">
        <div className="head-l">
          {back && <a className="icon-btn back" href="#/lainnya" aria-label={t.back}><Icon name="chevL" /></a>}
          <h1 className="hero-title">{title}</h1>
        </div>
        {action}
      </div>
      {sub && <p className="head-sub">{sub}</p>}
    </header>
  );
}
export function Empty({ icon = 'ledger', title, hint, children, small }) {
  return (
    <div className={`empty ${small ? 'small' : ''}`}>
      {!small && <div className="empty-art" aria-hidden="true"><Icon name={icon} size={22} /></div>}
      <p>{title}</p>{hint && <small>{hint}</small>}
      {children && <div className="empty-act">{children}</div>}
    </div>
  );
}
export function AddBtn({ label, onClick }) {
  return <button className="btn primary sm" onClick={onClick}><Icon name="plus" size={16} />{label}</button>;
}
export function Progress({ value, max, over }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const done = !over && max > 0 && value >= max; // a reached target gets one shine (M23)
  return <div className={`bar ${over ? 'over' : ''} ${done ? 'done' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ transform: `scaleX(${pct / 100})` }} /></div>;
}
// Amount of a bill in the main currency, for totals that mix accounts in different currencies.
export function useBase() {
  const { records, settings } = useStore();
  return (b) => billBase(b, records, settings.currency);
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

export function PeriodNav({ unit, anchor, setAnchor }) {
  const t = useT();
  return (
    <div className="period">
      <button className="icon-btn" aria-label={t.prev} onClick={() => setAnchor(shiftPeriod(unit, anchor, -1))}><Icon name="chevL" /></button>
      <span className="period-label">{periodLabel(unit, anchor, t)}</span>
      <button className="icon-btn" aria-label={t.next} onClick={() => setAnchor(shiftPeriod(unit, anchor, 1))}><Icon name="chevR" /></button>
    </div>
  );
}

export const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Data colours come from the design system's gradient pairs and semantic scale.
export const COLORS = ['#0070f3', '#00dfd8', '#50e3c2', '#29bc9b', '#7928ca', '#ff0080', '#eb367f', '#ff4d4d', '#f5a623', '#f9cb28', '#888888'];
const GROUPED = iconsByGroup();
const FLAT = GROUPED.flatMap((g) => g.icons.map((i) => i.key));

// The drawn icons under their group headings, as one radio group with a single tab stop:
// arrows move (up and down by a row of the grid), Home and End jump, Enter or Space selects.
export function IconPicker({ icon, color, onIcon, onColor }) {
  const t = useT(); const lang = useContext(LangCtx);
  const ref = useRef(null);
  const current = FLAT.includes(icon) ? icon : null;
  const [focusKey, setFocusKey] = useState(current || FLAT[0]);
  const move = (e) => {
    const opts = [...ref.current.querySelectorAll('[role="radio"]')];
    const i = opts.indexOf(document.activeElement);
    if (i < 0) return;
    // Columns of the grid this option sits in, read from the layout so it follows the screen width.
    const cols = Math.max(1, opts.filter((o) => o.parentElement === opts[i].parentElement && o.offsetTop === opts[i].offsetTop).length);
    let j = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: opts.length - 1 }[e.key];
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onIcon(opts[i].dataset.key); return; }
    if (j == null) return;
    e.preventDefault();
    j = Math.min(opts.length - 1, Math.max(0, j));
    setFocusKey(opts[j].dataset.key); opts[j].focus();
  };
  return (
    <div className="picker">
      <div className="icon-groups" role="radiogroup" aria-label={t.icon} ref={ref} onKeyDown={move}>
        {GROUPED.map((g) => (
          <div key={g.key} className="icon-group">
            <div className="icon-group-h" aria-hidden="true">{g[lang === 'en' ? 'en' : 'id']}</div>
            <div className="icon-grid">
              {g.icons.map((ic) => (
                <button key={ic.key} type="button" role="radio" data-key={ic.key} aria-checked={current === ic.key}
                  aria-label={iconName(ic.key, lang)} title={iconName(ic.key, lang)} tabIndex={focusKey === ic.key ? 0 : -1}
                  className={`icon-opt ${current === ic.key ? 'on' : ''}`} style={current === ic.key ? { background: (color || '#888888') + '33' } : undefined}
                  onClick={() => { setFocusKey(ic.key); onIcon(ic.key); }} onFocus={() => setFocusKey(ic.key)}>
                  <Icon name={ic.key} size={22} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {onColor && (
        <div className="color-row" role="radiogroup" aria-label={t.color}>
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onColor(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

