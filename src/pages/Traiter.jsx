import React, { useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { STATUS_LABELS, FREQUENCY_LABELS } from "../lib/planner/constants.js";
import { todayKey, yearBounds, frShort } from "../lib/planner/dates.js";
import { conflictPairs, sessionName } from "../lib/planner/occurrences.js";
import { Badge } from "../components/ui.jsx";

// Liste unifiée des réservations ponctuelles, séries et stages de l'année
function useUnits() {
  const P = usePlanner();
  return useMemo(() => {
    const nm = (x) => P.associations.find((a) => a.id === x.associationId)?.name || x.customName || "Réservation";
    const rn = (id) => P.rooms.find((r) => r.id === id)?.name || "Salle";
    const out = [];
    for (const b of P.bookings) if (!b.stageId) out.push({ key: "b" + b.id, kind: "booking", id: b.id, name: nm(b), assocId: b.associationId, when: b.startDate === b.endDate ? frShort(b.startDate) : `${frShort(b.startDate)} → ${frShort(b.endDate)}`, date: b.startDate, detail: `${b.start}–${b.end} · ${rn(b.roomId)}`, status: b.status, pay: b.paymentStatus, roomId: b.roomId });
    for (const r of P.recurring) out.push({ key: "r" + r.id, kind: "series", id: r.id, name: nm(r), assocId: r.associationId, when: `Série ${FREQUENCY_LABELS[r.frequency].toLowerCase()} · ${frShort(r.startDate)} → ${frShort(r.endDate)}`, date: r.startDate, detail: `${r.start}–${r.end} · ${rn(r.roomId)}`, status: r.status, pay: r.paymentStatus, roomId: r.roomId });
    for (const s of P.stages) out.push({ key: "s" + s.id, kind: "stage", id: s.id, name: `${nm(s)} — ${s.label}`, assocId: s.associationId, when: `${s.dates.length} jour(s) · ${frShort(s.dates[0])} → ${frShort(s.dates[s.dates.length - 1])}`, date: s.dates[0], detail: `${s.floorName} · ${s.start}–${s.end}`, status: s.status, pay: s.paymentStatus });
    return out.sort((a, c) => (a.date < c.date ? -1 : 1));
  }, [P.bookings, P.recurring, P.stages, P.associations, P.rooms]);
}

export function useTodoCounts() {
  const P = usePlanner();
  const units = useUnits();
  const conflicts = useConflicts();
  return { pending: units.filter((u) => u.status === "a_confirmer").length, unpaid: units.filter((u) => u.status === "confirme" && u.pay === "unpaid").length, conflicts: conflicts.length };
}

function useConflicts() {
  const P = usePlanner();
  return useMemo(() => {
    const t = todayKey();
    const map = new Map();
    for (const s of P.sessions) { if (s.date < t) continue; const k = s.date + "|" + s.roomId; if (!map.has(k)) map.set(k, []); map.get(k).push(s); }
    const out = [];
    for (const list of map.values()) for (const pair of conflictPairs(list, "same")) out.push(pair);
    return out.sort((a, b) => (a[0].date < b[0].date ? -1 : 1));
  }, [P.sessions]);
}

export default function Traiter({ goPlanning }) {
  const P = usePlanner();
  const units = useUnits();
  const conflicts = useConflicts();
  const [tab, setTab] = useState("pending");
  const [sel, setSel] = useState({});
  const pending = units.filter((u) => u.status === "a_confirmer");
  const unpaid = units.filter((u) => u.status === "confirme" && u.pay === "unpaid");
  const list = tab === "pending" ? pending : unpaid;
  const chosen = list.filter((u) => sel[u.key]);
  const toggleAll = (on) => setSel(on ? Object.fromEntries(list.map((u) => [u.key, true])) : {});
  const apply = (items, patch, label) => P.undoable(label, ["Booking", "RecurringBooking", "Stage"], () => P.setSourceFieldsBulk(items, patch, label));
  const see = (u) => { P.requestOpenDay(u.date, u.roomId); goPlanning(); };
  const refuse = (s) => P.undoable("Réservation refusée", ["Booking", "RecurringBooking", "Stage"], () => P.setSourceFields(s.kind, s.sourceId, { status: "annule" }));

  const Row = ({ u }) => (
    <tr>
      <td style={{ width: 28 }}><input type="checkbox" checked={!!sel[u.key]} onChange={(e) => setSel({ ...sel, [u.key]: e.target.checked })} /></td>
      <td><b>{u.name}</b><br /><span className="help">{u.when} · {u.detail}</span></td>
      <td><Badge kind="status" value={u.status} /> <Badge kind="payment" value={u.pay} /></td>
      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
        {tab === "pending" ? (<><button className="link" onClick={() => apply([u], { status: "confirme" }, "Réservation validée")}>Valider</button><button className="link link-danger" onClick={() => apply([u], { status: "annule" }, "Réservation refusée")}>Refuser</button></>)
          : <button className="link" onClick={() => apply([u], { paymentStatus: "paid" }, "Marqué payé")}>Marquer payé</button>}
        {u.kind !== "stage" && <button className="link link-muted" onClick={() => see(u)}>Voir</button>}
      </td>
    </tr>
  );

  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === "pending" ? "on" : ""} onClick={() => { setTab("pending"); setSel({}); }}>À valider ({pending.length})</button>
        <button className={tab === "unpaid" ? "on" : ""} onClick={() => { setTab("unpaid"); setSel({}); }}>À encaisser ({unpaid.length})</button>
        <button className={tab === "conflicts" ? "on" : ""} onClick={() => setTab("conflicts")}>Conflits ({conflicts.length})</button>
      </div>
      {tab !== "conflicts" && (
        <div className="card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
            <h2 className="serif" style={{ marginRight: "auto" }}>{tab === "pending" ? "Réservations en attente de validation" : "Réservations validées non payées"}</h2>
            <button className="btn" onClick={() => toggleAll(chosen.length < list.length)}>{chosen.length < list.length ? "Tout cocher" : "Tout décocher"}</button>
            {tab === "pending" ? (<><button className="btn btn-primary" disabled={!chosen.length} onClick={() => apply(chosen, { status: "confirme" }, `${chosen.length} validée(s)`) || setSel({})}>Valider la sélection</button><button className="btn" disabled={!chosen.length} onClick={() => P.ask(`Refuser ${chosen.length} réservation(s) ?`, () => { apply(chosen, { status: "annule" }, `${chosen.length} refusée(s)`); setSel({}); })}>Refuser la sélection</button></>)
              : <button className="btn btn-primary" disabled={!chosen.length} onClick={() => { apply(chosen, { paymentStatus: "paid" }, `${chosen.length} marquée(s) payée(s)`); setSel({}); }}>Marquer payé la sélection</button>}
          </div>
          {list.length === 0 ? <p className="help">{tab === "pending" ? "Rien à valider. 🎉" : "Rien à encaisser."}</p> : <table className="table"><tbody>{list.map((u) => <Row key={u.key} u={u} />)}</tbody></table>}
          {tab === "unpaid" && unpaid.length > 0 && <p className="help" style={{ marginTop: 8 }}>Pour facturer, utilisez « Relevés de frais » : le règlement d'un relevé peut marquer les séances payées automatiquement.</p>}
        </div>
      )}
      {tab === "conflicts" && (
        <div className="card">
          <h2 className="serif" style={{ marginBottom: 8 }}>Conflits d'horaires à venir</h2>
          {conflicts.length === 0 ? <p className="help">Aucun conflit à venir. 🎉</p> : conflicts.map(([a, b], i) => {
            const room = P.rooms.find((r) => r.id === a.roomId)?.name;
            return (
              <div key={i} style={{ border: "1px solid #F09595", borderRadius: 8, padding: "8px 10px", marginBottom: 8, background: "#FCEBEB55" }}>
                <b>{frShort(a.date)} · {room}</b>
                {[a, b].map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "4px 0" }}>
                    <span>{s.start}–{s.end} · {sessionName(s, P.associations)} <span className="help">({STATUS_LABELS[s.status]})</span></span>
                    <span><button className="link link-danger" disabled={!!s.stageId} onClick={() => refuse(s)}>Refuser celle-ci</button><button className="link" onClick={() => { P.requestOpenDay(s.date, s.roomId); goPlanning(); }}>Ouvrir le jour</button></span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
