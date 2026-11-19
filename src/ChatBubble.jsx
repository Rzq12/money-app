// Expandable chat bubble on the Ledger (M44): a round chat button that unfolds into suggestion pills.
// Once per app session the pills unfold by themselves shortly after the Ledger opens, and fold back if
// they are left alone. A pill opens the chat page, either with its question already sent or ready to type.
import React, { useEffect, useRef, useState } from 'react';
import { useT, Icon } from './ui.jsx';
import { useAi } from './ai.js';

const SHOW_AFTER = 1200, HIDE_AFTER = 6000;
let teased = false; // the automatic unfold plays once per app session, not on every return to the Ledger

const go = (q) => { location.hash = q ? `#/chat?q=${encodeURIComponent(q)}` : '#/chat?focus=1'; };

export default function ChatBubble() {
  const t = useT(); const ai = useAi();
  const [open, setOpen] = useState(false);
  const root = useRef(null); const auto = useRef(null);

  useEffect(() => {
    if (teased) return undefined;
    teased = true;
    const show = setTimeout(() => { setOpen(true); auto.current = setTimeout(() => setOpen(false), HIDE_AFTER); }, SHOW_AFTER);
    return () => { clearTimeout(show); clearTimeout(auto.current); };
  }, []);

  // Any touch outside, or Escape, folds the pills away.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  // Questions need AI; with AI off only the plain "ask something" pill is offered.
  const pills = [{ label: t.cbAsk, q: '' }, ...(ai.off ? [] : [{ label: t.cbSpend, q: t.cbSpendQ }, { label: t.cbAnalyse, q: t.cbAnalyseQ }])];
  const keep = () => clearTimeout(auto.current); // once touched, the automatic fold no longer applies

  return (
    <div ref={root} className={`cb${open ? ' open' : ''}`} onPointerEnter={keep} onFocus={keep}>
      <div className="cb-pills" id="cb-pills" aria-hidden={!open}>
        {pills.map((p, i) => (
          <button key={i} type="button" className="cb-pill" style={{ '--i': pills.length - 1 - i }} tabIndex={open ? 0 : -1} onClick={() => go(p.q)}>
            {i === 0 && <Icon name="chat" size={14} />}{p.label}
          </button>
        ))}
      </div>
      <button type="button" className="cb-btn" aria-expanded={open} aria-controls="cb-pills" aria-label={open ? t.cbClose : t.cbOpen}
        onClick={() => { keep(); setOpen((o) => !o); }}>
        <Icon name="chat" size={22} /><Icon name="close" size={20} />
      </button>
    </div>
  );
}
