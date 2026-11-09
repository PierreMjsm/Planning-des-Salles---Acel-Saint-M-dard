import React, { useEffect } from "react";
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
