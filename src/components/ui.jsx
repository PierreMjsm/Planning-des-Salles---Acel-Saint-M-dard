import React, { useEffect, useRef, useState } from "react";
import { PALETTE, REFUSED_STYLE, STATUS_SHORT, PAYMENT_SHORT } from "../lib/planner/constants.js";

export function Modal({ title, subtitle, onClose, width = 640, children, noPrint }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className={"overlay" + (noPrint ? " no-print" : "")} onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className="modal" style={{ maxWidth: width }}>
        <div className="modal-head">
          <div>
            <h2 className="serif" style={{ fontSize: 20 }}>{title}</h2>
            {subtitle && <p className="help" style={{ marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button className="btn btn-icon" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const styleFor = (s, assoc, room) => {
  if (s.status === "annule") return REFUSED_STYLE;
  const idx = assoc ? assoc.colorIdx : room ? room.colorIdx : 0;
  return PALETTE[(idx || 0) % PALETTE.length];
};

export function Badge({ kind, value }) {
  const map = {
    status: { confirme: "tag-green", a_confirmer: "tag-amber", annule: "tag-grey" },
    payment: { unpaid: "tag-red", paid: "tag-green", exempt: "tag-grey" },
  };
  const label = kind === "status" ? STATUS_SHORT[value] : PAYMENT_SHORT[value];
  return <span className={"tag " + map[kind][value]}>{label}</span>;
}

export const Field = ({ label, children, help }) => (
  <div style={{ marginBottom: 10 }}>
    <label className="lbl">{label}</label>
    {children}
    {help && <p className="help" style={{ marginTop: 3 }}>{help}</p>}
  </div>
);

const TIME_RE = /^([01]?\d|2[0-3]):?([0-5]\d)$/;
const normTime = (v) => { const m = TIME_RE.exec((v || "").trim()); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null; };
// Saisie d'heure au clavier (ex. 9:30, 0930, 18h00 → 18:00) ; la valeur n'est validée qu'une fois complète
export function TimeInput({ value, onChange, ...rest }) {
  const [d, setD] = useState(value || "");
  const focus = useRef(false);
  useEffect(() => { if (!focus.current) setD(value || ""); }, [value]);
  const commit = (v) => { const n = normTime(v.replace(/[hH]/, ":")); if (n) onChange(n); return n; };
  return (
    <input className="planner-field" type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} value={d} {...rest}
      onFocus={(e) => { focus.current = true; e.target.select(); }}
      onChange={(e) => { const v = e.target.value.replace(/[^0-9:hH]/g, ""); setD(v); commit(v); }}
      onBlur={() => { focus.current = false; const n = commit(d); setD(n || value || ""); }} />
  );
}
// Saisie d'un nombre au clavier (entier ou décimal), sans perte de focus
export function NumInput({ value, onChange, decimal = false, ...rest }) {
  const [d, setD] = useState(value === null || value === undefined ? "" : String(value));
  const focus = useRef(false);
  useEffect(() => { if (!focus.current) setD(value === null || value === undefined ? "" : String(value)); }, [value]);
  return (
    <input className="planner-field" type="text" inputMode={decimal ? "decimal" : "numeric"} value={d} {...rest}
      onFocus={() => { focus.current = true; }}
      onChange={(e) => { const v = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, ""); setD(v); onChange(v); }}
      onBlur={() => { focus.current = false; }} />
  );
}
// Date saisissable : ignore les états intermédiaires vides
export function DateInput({ value, onChange, ...rest }) {
  const [d, setD] = useState(value || "");
  const focus = useRef(false);
  useEffect(() => { if (!focus.current) setD(value || ""); }, [value]);
  return (
    <input className="planner-field" type="date" value={d} {...rest}
      onFocus={() => { focus.current = true; }}
      onChange={(e) => { setD(e.target.value); if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && e.target.value.slice(0, 1) !== "0") onChange(e.target.value); }}
      onBlur={() => { focus.current = false; setD(value || ""); }} />
  );
}
