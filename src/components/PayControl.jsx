import React, { useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { controlRows, controlSummary } from "../lib/planner/paycontrol.js";
import { periodsFor } from "../lib/planner/billing.js";
import { todayKey, frShort, schoolYearOf } from "../lib/planner/dates.js";
import { fmtMoney } from "../lib/planner/format.js";
import { PAYMENT_METHODS } from "../lib/planner/constants.js";
import { DateInput, Field } from "./ui.jsx";

// Toutes les deux mois : la liste de ceux qui sont venus, pour pointer les règlements.
// Cocher marque payé dans le planning et encaisse le relevé quand il y en a un.
export default function PayControl({ onPrepare }) {
  const P = usePlanner();
  const periods = useMemo(() => [...periodsFor("bimonthly", P.year - 1), ...periodsFor("bimonthly", P.year)], [P.year]);
  const [idx, setIdx] = useState(() => {
    const t = todayKey();
    const done = periods.map((p, i) => ({ p, i })).filter((x) => x.p.to < t);
    return done.length ? done[done.length - 1].i : Math.max(0, periods.length - 1);
  });
  const per = periods[Math.min(idx, periods.length - 1)] || { from: todayKey(), to: todayKey(), label: "" };
  const [from, setFrom] = useState(per.from);
  const [to, setTo] = useState(per.to);
  const [method, setMethod] = useState("virement");
  const [date, setDate] = useState(todayKey());
  const [hideDone, setHideDone] = useState(false);
  React.useEffect(() => { setFrom(per.from); setTo(per.to); }, [idx]);

  const rows = useMemo(() => controlRows({ sessions: P.allSessions(from, to), invoices: P.db.Invoice, associations: P.allAssociations, rooms: P.rooms, stages: P.db.Stage, from, to }),
    [from, to, P.allSessions, P.db.Invoice, P.allAssociations, P.rooms, P.db.Stage]);
  const sum = useMemo(() => controlSummary(rows), [rows]);
  const shown = hideDone ? rows.filter((r) => !r.settled) : rows;
  const move = (d) => setIdx((i) => Math.max(0, Math.min(periods.length - 1, i + d)));
  const tick = (r, on) => P.setControlPaid(r, from, to, on, { method, date });
  const tickAll = () => {
    const left = rows.filter((r) => !r.settled && r.state !== "no-invoice");
    if (!left.length) return P.notify("Rien à encaisser sur cette période");
    P.ask(`Marquer payées les ${left.length} association(s) dont le relevé reste à encaisser ?`, () => left.forEach((r) => P.setControlPaid(r, from, to, true, { method, date })));
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <button className="btn btn-icon" onClick={() => move(-1)} aria-label="Période précédente" disabled={idx <= 0}>‹</button>
          <b className="serif" style={{ fontSize: 17, minWidth: 210 }}>{per.label || `${frShort(from)} → ${frShort(to)}`}</b>
          <button className="btn btn-icon" onClick={() => move(1)} aria-label="Période suivante" disabled={idx >= periods.length - 1}>›</button>
          <Field label="Du"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Au"><DateInput value={to} onChange={setTo} /></Field>
        </div>
        <p className="help" style={{ marginBottom: 8 }}>Tous ceux qui sont venus sur la période, y compris une association venue une seule fois. Cocher marque les séances payées dans le planning et encaisse le relevé qui couvre la période ; décocher défait exactement cela. Tout est annulable avec ↶.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className={"tag " + (sum.left ? "tag-amber" : "tag-green")}>{sum.done} / {sum.total} pointé(s)</span>
          {sum.left > 0 && <span className="tag tag-red">{fmtMoney(sum.rest)} à encaisser</span>}
          {sum.noInvoice > 0 && <span className="tag tag-grey">{sum.noInvoice} sans relevé</span>}
          <label className="help" style={{ display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />Masquer ceux qui sont réglés</label>
          <span style={{ flex: 1 }} />
          <span className="help">Règlement :</span>
          <select className="planner-field" style={{ width: 150 }} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Mode de paiement">{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          <DateInput value={date} onChange={setDate} />
          <button className="btn" onClick={tickAll}>Tout encaisser</button>
        </div>
      </div>
      <div className="card">
        <table className="table paycontrol">
          <thead><tr><th style={{ width: 34 }}>Payé</th><th>Qui est venu</th><th style={{ textAlign: "center" }}>Séances</th><th>Dates</th><th style={{ textAlign: "right" }}>Montant</th><th>Relevé</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} className={r.settled ? "pc-done" : ""}>
                <td style={{ textAlign: "center" }}>
                  <input type="checkbox" aria-label={`Payé : ${r.name}`} checked={r.settled} disabled={r.state === "no-invoice" && !r.settled && r.kinds.includes("series")} onChange={(e) => tick(r, e.target.checked)} />
                </td>
                <td><b>{r.name}</b>{r.stages > 0 && <span className="help"> · {r.stages} stage(s)</span>}</td>
                <td style={{ textAlign: "center" }}>{r.sessions}</td>
                <td className="help">{frShort(r.firstDate)}{r.lastDate !== r.firstDate ? ` → ${frShort(r.lastDate)}` : ""}</td>
                <td style={{ textAlign: "right" }}>{fmtMoney(r.amount)}{!r.invoices.length && <span className="help"> est.</span>}</td>
                <td>
                  {r.state === "ok" && <span className="tag tag-green">réglé</span>}
                  {r.state === "to-cash" && <span className="tag tag-amber">à encaisser · {r.invoices.map((i) => i.number).join(", ")}</span>}
                  {r.state === "no-invoice" && (r.settled
                    ? <span className="tag tag-green">payé sans relevé</span>
                    : <><span className="tag tag-grey">pas de relevé</span> <button className="link" onClick={() => onPrepare && onPrepare(r, from, to)}>Préparer</button></>)}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6}><p className="help" style={{ margin: 6 }}>{rows.length ? "Tout est pointé sur cette période." : "Personne n'est venu sur cette période."}</p></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
