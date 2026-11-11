import React, { useState } from "react";
import { Modal, Badge, DateInput } from "./ui.jsx";
import BookingForm from "./BookingForm.jsx";
import StageModal from "./StageModal.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { frLong, capitalize } from "../lib/planner/dates.js";
import { sessionName, freeSlots, conflictPairs, closureFor } from "../lib/planner/occurrences.js";
import { STATUS_LABELS, PAYMENT_LABELS, DAY_START, DAY_END } from "../lib/planner/constants.js";

// Détail d'un jour (pour une salle ou toutes les salles)
export default function DayModal({ date, roomId, onClose }) {
  const P = usePlanner();
  const [form, setForm] = useState(null);
  const rooms = roomId ? P.rooms.filter((r) => r.id === roomId) : P.rooms;
  const dayAll = P.allSessions(date, date);

  const editSession = (s) => {
    if (s.kind === "booking") setForm({ booking: P.db.Booking.find((b) => b.id === s.sourceId) });
    else setForm({ series: P.db.RecurringBooking.find((b) => b.id === s.sourceId) });
  };
  const [move, setMove] = useState(null);
  const [stageEdit, setStageEdit] = useState(null);
  const [menu, setMenu] = useState(null);
  React.useEffect(() => { if (!menu) return; const h = () => setMenu(null); window.addEventListener("click", h); return () => window.removeEventListener("click", h); }, [menu]);
  const moveDay = (s) => setMove({ s, date });
  const doMove = () => {
    const { s, date: nd } = move;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nd) || nd === date) { setMove(null); return; }
    P.undoable("Séance déplacée", ["RecurringBooking", "Booking"], () => {
      P.cancelOccurrence(s.sourceId, date);
      P.saveBooking({ roomId: s.roomId, associationId: s.associationId, customName: s.customName, startDate: nd, endDate: nd, start: s.start, end: s.end, participants: s.participants, contact: s.contact, equipment: s.equipment, note: s.note, internalNote: s.internalNote, status: s.status, paymentStatus: s.paymentStatus });
    });
    setMove(null);
  };
  const stopSeries = (s) => P.ask("Arrêter la série à partir de cette date ?", () => {
    const prev = new Date(date + "T00:00:00"); prev.setDate(prev.getDate() - 1);
    const k = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
    P.updateRecurringFields(s.sourceId, { endDate: k });
  });
  const prefill = (s, extra = {}) => ({ date, roomId: s.roomId, start: s.start, end: s.end, associationId: s.associationId, customName: s.customName, participants: s.participants, contact: s.contact, equipment: s.equipment, note: s.note, internalNote: s.internalNote, status: s.status, paymentStatus: s.paymentStatus, ...extra });
  const editOne = (s) => setForm({ initial: prefill(s, { replaceOccurrence: { seriesId: s.sourceId, date } }) });
  const duplicate = (s) => setForm({ initial: prefill(s) });
  const repeat = (s) => setForm({ initial: prefill(s, { recurring: true, replaceBookingId: s.stageId ? "" : s.sourceId }) });

  // Menu « Plus » : les actions rares, une seule liste ouverte à la fois
  const More = ({ id, children }) => (
    <span className="more-wrap">
      <button className="link" aria-haspopup="menu" aria-expanded={menu === id} onClick={(e) => { e.stopPropagation(); setMenu(menu === id ? null : id); }}>Plus ▾</button>
      {menu === id && <div className="pop more-pop" role="menu" onClick={() => setMenu(null)}>{children}</div>}
    </span>
  );
  if (stageEdit) return <StageModal stage={stageEdit} onClose={() => setStageEdit(null)} />;
  if (form) {
    return <BookingForm initial={form.initial || { date, roomId }} booking={form.booking} series={form.series} onClose={() => setForm(null)} />;
  }
  if (move) return (
    <Modal title="Déplacer cette séance" subtitle={sessionName(move.s, P.associations)} onClose={() => setMove(null)} width={420}>
      <label className="lbl">Nouvelle date</label>
      <DateInput value={move.date} onChange={(v) => setMove({ ...move, date: v })} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button className="btn" onClick={() => setMove(null)}>Annuler</button><button className="btn btn-primary" onClick={doMove}>Déplacer</button></div>
    </Modal>
  );
  return (
    <Modal title={capitalize(frLong(date))} subtitle={roomId ? rooms[0]?.name : "Toutes les salles"} onClose={onClose} width={720}>
      {rooms.map((room) => {
        const list = dayAll.filter((s) => s.roomId === room.id);
        const closure = closureFor(P.closures, room.id, date);
        const pairs = conflictPairs(list, "same");
        const conflictIds = new Set(pairs.flat().map((s) => s.id));
        const free = freeSlots(list, DAY_START, DAY_END);
        return (
          <div key={room.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <b className="serif" style={{ fontSize: 15 }}>{room.name}</b>
              {closure && <span className="tag tag-grey">Fermée : {closure.label}</span>}
            </div>
            {list.length === 0 && <p className="help">Aucune réservation.</p>}
            {list.map((s) => (
              <div key={s.id} style={{ border: `1px solid ${conflictIds.has(s.id) ? "#E24B4A" : "var(--border)"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div><b>{sessionName(s, P.associations)}</b> <span className="help">{s.start}–{s.end}{s.kind === "series" ? " · récurrente" : ""}</span></div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Badge kind="status" value={s.status} />{s.paymentStatus !== "unpaid" && <Badge kind="payment" value={s.paymentStatus} />}{P.isLate(s) && <span className="tag tag-red">Relevé en retard</span>}
                  </div>
                </div>
                {conflictIds.has(s.id) && <div className="banner banner-red" style={{ marginTop: 6, marginBottom: 0 }}>Conflit d'horaire avec une autre réservation de cette salle.</div>}
                {(s.participants || s.contact || s.equipment || s.note) && <p className="help" style={{ marginTop: 4 }}>{[s.participants && `${s.participants} pers.`, s.contact, s.equipment, s.note].filter(Boolean).join(" · ")}</p>}
                {s.internalNote && <p className="help" style={{ marginTop: 2, fontStyle: "italic" }}>Note interne : {s.internalNote}</p>}
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                  {s.stageId ? (<>
                    <button className="link" onClick={() => setStageEdit(P.db.Stage.find((x) => x.id === s.stageId))}>Modifier le stage</button>
                    {s.status !== "confirme" && <button className="link" onClick={() => P.updateStageStatus(s.stageId, { status: "confirme" })}>Valider le stage</button>}
                    <More id={s.id}>
                      <button onClick={() => P.ask("Retirer cette journée du stage (toutes les salles de l'étage) ? Elle ne sera plus comptée dans le relevé.", () => P.removeStageDay(s.stageId, date))}>Retirer cette journée du stage</button>
                      {s.paymentStatus === "unpaid" && <button onClick={() => P.updateStageStatus(s.stageId, { paymentStatus: "paid" })}>Marquer le stage payé</button>}
                      <button className="danger" onClick={() => P.ask("Supprimer tout le stage (tous les jours et toutes les salles) ?", () => P.deleteStage(s.stageId))}>Supprimer tout le stage</button>
                    </More>
                  </>) : s.kind === "booking" ? (<>
                    <button className="link" onClick={() => editSession(s)}>Modifier</button>
                    {s.status !== "confirme" && <button className="link" onClick={() => P.saveBooking({ ...P.db.Booking.find((b) => b.id === s.sourceId), status: "confirme" }, s.sourceId)}>Valider</button>}
                    <button className="link link-danger" onClick={() => P.ask("Supprimer cette réservation ?", () => P.deleteBooking(s.sourceId))}>Supprimer</button>
                    <More id={s.id}>
                      <button onClick={() => duplicate(s)}>Dupliquer</button>
                      <button onClick={() => repeat(s)}>Répéter chaque semaine</button>
                      {s.paymentStatus === "unpaid" && <button onClick={() => P.updateBookingPayment(s.sourceId, "paid")}>Marquer payé</button>}
                    </More>
                  </>) : (<>
                    <button className="link" onClick={() => editOne(s)}>Modifier cette séance</button>
                    <button className="link" onClick={() => P.cancelOccurrence(s.sourceId, date)}>Annuler cette séance</button>
                    {s.status !== "confirme" && <button className="link" onClick={() => P.updateRecurringFields(s.sourceId, { status: "confirme" })}>Valider la série</button>}
                    <More id={s.id}>
                      <button onClick={() => editSession(s)}>Modifier toute la série</button>
                      <button onClick={() => moveDay(s)}>Déplacer cette séance</button>
                      <button onClick={() => duplicate(s)}>Dupliquer</button>
                      {s.paymentStatus === "unpaid" && <button onClick={() => P.updateRecurringFields(s.sourceId, { paymentStatus: "paid" })}>Marquer la série payée</button>}
                      <button onClick={() => stopSeries(s)}>Arrêter la série à cette date</button>
                      <button className="danger" onClick={() => P.ask("Supprimer toute la série ?", () => P.deleteRecurring(s.sourceId))}>Supprimer toute la série</button>
                    </More>
                  </>)}
                </div>
              </div>
            ))}
            <p className="help">Créneaux libres : {free.length ? free.join(" · ") : "aucun"}</p>
            <button className="link" onClick={() => setForm({ initial: { date, roomId: room.id } })}>+ Réserver cette salle</button>
          </div>
        );
      })}
    </Modal>
  );
}
