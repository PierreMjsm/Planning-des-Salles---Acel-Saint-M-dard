import React, { useMemo, useRef, useState, useEffect } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { sessionName } from "../lib/planner/occurrences.js";
import { frShort, todayKey } from "../lib/planner/dates.js";
import { fmtMoney } from "../lib/planner/format.js";

const NORM = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Recherche commune à toutes les pages : une association, une réservation
// (copropriété ou particulier compris) ou un relevé de frais, par nom ou numéro.
export default function GlobalSearch() {
  const P = usePlanner();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ref.current && ref.current.focus(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  const res = useMemo(() => {
    const n = NORM(q.trim());
    if (n.length < 2) return null;
    const t = todayKey();
    const assocs = P.associations.filter((a) => NORM(a.name).includes(n) || NORM(a.billingName).includes(n)).slice(0, 5);
    const all = P.yearSessions.filter((s) => NORM(sessionName(s, P.allAssociations)).includes(n));
    // d'abord ce qui vient, puis le passé le plus récent
    const next = all.filter((s) => s.date >= t).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const past = all.filter((s) => s.date < t).sort((a, b) => b.date.localeCompare(a.date));
    const sess = [...next, ...past].slice(0, 6);
    // les relevés de toutes les années : l'année bascule à l'ouverture si besoin
    const invs = P.db.Invoice.filter((i) => NORM(i.number).includes(n) || NORM(i.associationName).includes(n))
      .sort((a, c) => String(c.issuedAt || "").localeCompare(String(a.issuedAt || ""))).slice(0, 5);
    return { assocs, sess, invs, total: assocs.length + sess.length + invs.length };
  }, [q, P.yearSessions, P.associations, P.allAssociations, P.db.Invoice]);

  const close = () => { setOpen(false); setQ(""); };
  const voirSeance = (s) => { P.requestOpenDay(s.date, s.roomId); close(); };
  const voirAssoc = (a) => {
    const t = todayKey();
    const mine = P.yearSessions.filter((s) => s.associationId === a.id);
    const s = mine.filter((x) => x.date >= t).sort((x, y) => x.date.localeCompare(y.date))[0] || mine.sort((x, y) => y.date.localeCompare(x.date))[0];
    if (!s) { P.notify(`${a.name} n'a aucun créneau cette année`); close(); return; }
    voirSeance(s);
  };
  const voirReleve = (i) => { P.requestBilling({ invoiceId: i.id }); close(); };

  const Ligne = ({ onClick, titre, detail }) => (
    <button className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", height: "auto", padding: "6px 8px", textAlign: "left", whiteSpace: "normal" }} onClick={onClick}>
      <span><b>{titre}</b><br /><span className="help">{detail}</span></span>
    </button>
  );
  const Titre = ({ children }) => <div className="help" style={{ padding: "4px 8px 2px", textTransform: "uppercase", fontSize: 10, letterSpacing: 0.4 }}>{children}</div>;

  return (
    <div ref={box} style={{ position: "relative", minWidth: 150, flex: "0 1 230px" }}>
      <input ref={ref} className="planner-field" aria-label="Rechercher partout" placeholder="Rechercher…  ( Ctrl+K )"
        value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && res && (
        <div className="card" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 60, maxHeight: 420, overflow: "auto", padding: 4, minWidth: 280 }}>
          {res.total === 0 && <p className="help" style={{ padding: "6px 8px" }}>Rien trouvé pour « {q.trim()} ».</p>}
          {res.assocs.length > 0 && <Titre>Associations</Titre>}
          {res.assocs.map((a) => <Ligne key={a.id} onClick={() => voirAssoc(a)} titre={a.name} detail="Voir son prochain créneau" />)}
          {res.sess.length > 0 && <Titre>Réservations</Titre>}
          {res.sess.map((s) => <Ligne key={s.id} onClick={() => voirSeance(s)} titre={sessionName(s, P.allAssociations)} detail={`${frShort(s.date)} · ${s.start}–${s.end}`} />)}
          {res.invs.length > 0 && <Titre>Relevés de frais</Titre>}
          {res.invs.map((i) => <Ligne key={i.id} onClick={() => voirReleve(i)} titre={`${i.number} · ${i.associationName}`} detail={`${fmtMoney(i.total)} · ${i.amountPaid >= i.total ? "payé" : "à régler"}`} />)}
        </div>
      )}
    </div>
  );
}
