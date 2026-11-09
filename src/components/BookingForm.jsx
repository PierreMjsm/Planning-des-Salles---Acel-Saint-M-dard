import React, { useMemo, useState } from "react";
import { Modal, Field } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { STATUS_LABELS, PAYMENT_LABELS, FREQUENCY_LABELS, DEFAULT_START, DEFAULT_END, WEEKDAYS } from "../lib/planner/constants.js";
import { schoolYearOf, yearBounds, weekdayIndex, addDays } from "../lib/planner/dates.js";
import { sessionsInRange, conflictPairs, conflictText, closureInRange, toMin, sessionName } from "../lib/planner/occurrences.js";

// props: initial {date, roomId, start, end}, booking (édition), series (édition de série), onClose
export default function BookingForm({ initial = {}, booking, series, onClose }) {
  const P = usePlanner();
  const src = booking || series;
  const [f, setF] = useState(() => ({
    roomId: src?.roomId || initial.roomId || P.rooms[0]?.id || "",
    associationId: src?.associationId || initial.associationId || "",
    customName: src?.customName || initial.customName || "",
    startDate: src?.startDate || initial.date || P.date,
    endDate: src?.endDate || initial.endDate || initial.date || P.date,
    start: src?.start || initial.start || DEFAULT_START,
    end: src?.end || initial.end || DEFAULT_END,
    participants: src?.participants || initial.participants || "",
    contact: src?.contact || initial.contact || "",
    equipment: src?.equipment || initial.equipment || "",
    note: src?.note || "",
    internalNote: src?.internalNote || "",
    status: src?.status || "confirme",
    paymentStatus: src?.paymentStatus || "unpaid",
    recurring: !!series,
    frequency: series?.frequency || "weekly",
    weekday: series?.weekday ?? weekdayIndex(initial.date || P.date),
  }));
  const [error, setError] = useState("");
  const [tplName, setTplName] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const room = P.rooms.find((r) => r.id === f.roomId);
  const editing = !!src;
  const isSeries = f.recurring;

  const applyTemplate = (id) => {
    const t = P.templates.find((x) => x.id === id);
    if (!t) return;
    setF((x) => ({ ...x, roomId: t.roomId || x.roomId, associationId: t.associationId || "", customName: t.customName || "", start: t.start || x.start, end: t.end || x.end, participants: t.participants || "", contact: t.contact || "", equipment: t.equipment || "", status: t.status || x.status, paymentStatus: t.paymentStatus || x.paymentStatus }));
  };

  const preview = useMemo(() => {
    if (!f.roomId || toMin(f.start) == null || toMin(f.end) == null || toMin(f.end) <= toMin(f.start) || f.endDate < f.startDate) return { conflicts: "", closure: null };
    const mine = { id: "__new", roomId: f.roomId, associationId: f.associationId, customName: f.customName, startDate: f.startDate, endDate: f.endDate, start: f.start, end: f.end, status: f.status, weekday: f.weekday, frequency: f.frequency };
    const others = P.allSessions(f.startDate, f.endDate).filter((s) => s.roomId === f.roomId && s.sourceId !== src?.id);
    const mineS = isSeries ? sessionsInRange([], [mine], f.startDate, f.endDate) : sessionsInRange([mine], [], f.startDate, f.endDate);
    const pairs = [];
    for (const m of mineS) {
      const same = others.filter((o) => o.date === m.date);
      pairs.push(...conflictPairs([m, ...same], "same").filter(([a, b]) => a.id === "booking:__new:" + m.date || a.id === "series:__new:" + m.date || b.id.includes("__new")));
    }
    return { conflicts: conflictText(pairs.slice(0, 3), P.associations), n: pairs.length, closure: closureInRange(P.closures, f.roomId, f.startDate, f.endDate) };
  }, [f, P.associations, P.closures, src]);

  const submit = () => {
    if (!f.roomId) return setError("Choisissez une salle.");
    if (!f.associationId && !f.customName.trim()) return setError("Choisissez une association ou saisissez un nom libre.");
    if (toMin(f.start) == null || toMin(f.end) == null || toMin(f.end) <= toMin(f.start)) return setError("L'heure de fin doit être après l'heure de début.");
    if (f.endDate < f.startDate) return setError("Le dernier jour doit être après le premier jour.");
    if (schoolYearOf(f.startDate) !== P.year && !editing) { /* autorisé : la saisie suit l'année du premier jour */ }
    const common = { roomId: f.roomId, associationId: f.associationId, customName: f.customName.trim(), startDate: f.startDate, endDate: f.endDate, start: f.start, end: f.end, participants: f.participants, contact: f.contact, equipment: f.equipment, note: f.note, internalNote: f.internalNote, status: f.status, paymentStatus: f.paymentStatus };
    if (isSeries) {
      const b = yearBounds(schoolYearOf(f.startDate));
      P.saveRecurring({ ...common, endDate: f.endDate === f.startDate ? b.end : f.endDate, frequency: f.frequency, weekday: f.frequency === "weekly" ? Number(f.weekday) : null }, series?.id);
    } else P.saveBooking(common, booking?.id);
    onClose();
  };

  const saveTpl = () => {
    if (!tplName.trim()) return setError("Donnez un nom au modèle.");
    P.saveTemplate({ name: tplName.trim(), roomId: f.roomId, associationId: f.associationId, customName: f.customName, start: f.start, end: f.end, participants: f.participants, contact: f.contact, equipment: f.equipment, status: f.status, paymentStatus: f.paymentStatus });
    setTplName("");
  };
  const capAlert = room?.capacity && Number(f.participants) > Number(room.capacity);

  return (
    <Modal title={editing ? (isSeries ? "Modifier la série" : "Modifier la réservation") : "Nouvelle réservation"} onClose={onClose} width={680}>
      {error && <div className="banner banner-red">{error}</div>}
      {preview.n > 0 && <div className="banner banner-red"><b>Conflit d'horaire</b> dans cette salle : {preview.conflicts}</div>}
      {preview.closure && <div className="banner banner-amber">La salle est fermée : {preview.closure.label}</div>}
      {capAlert && <div className="banner banner-amber">Attention : {f.participants} participants pour une capacité de {room.capacity}.</div>}
      {!editing && P.templates.length > 0 && (
        <Field label="Modèle">
          <select className="planner-field" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Choisir un modèle —</option>
            {P.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
      <div className="row">
        <Field label="Association"><select className="planner-field" value={f.associationId} onChange={(e) => set("associationId", e.target.value)}><option value="">— Aucune (nom libre) —</option>{P.associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Nom libre"><input className="planner-field" value={f.customName} disabled={!!f.associationId} onChange={(e) => set("customName", e.target.value)} placeholder="Ex. Réunion de copropriété" /></Field>
      </div>
      <Field label="Salle"><select className="planner-field" value={f.roomId} onChange={(e) => set("roomId", e.target.value)}>{P.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
      <div className="row">
        <Field label="Premier jour"><input type="date" className="planner-field" value={f.startDate} onChange={(e) => { set("startDate", e.target.value); if (f.endDate < e.target.value) set("endDate", e.target.value); }} /></Field>
        <Field label="Dernier jour"><input type="date" className="planner-field" value={f.endDate} min={f.startDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
        <Field label="Début"><input type="time" className="planner-field" value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
        <Field label="Fin"><input type="time" className="planner-field" value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
      </div>
      <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={f.recurring} disabled={editing} onChange={(e) => set("recurring", e.target.checked)} />
          Répéter (réservation récurrente)
        </label>
        {f.recurring && (
          <div className="row" style={{ marginTop: 8 }}>
            <Field label="Fréquence"><select className="planner-field" value={f.frequency} onChange={(e) => set("frequency", e.target.value)}>{Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {f.frequency === "weekly" && <Field label="Jour"><select className="planner-field" value={f.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>{WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}</select></Field>}
          </div>
        )}
        {f.recurring && <p className="help">Sans « Dernier jour » distinct du premier, la série court jusqu'à la fin de l'année scolaire.</p>}
      </div>
      <div className="row">
        <Field label="Validation"><select className="planner-field" value={f.status} onChange={(e) => set("status", e.target.value)}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Paiement"><select className="planner-field" value={f.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>{Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div className="row">
        <Field label="Participants"><input type="number" min="0" className="planner-field" value={f.participants} onChange={(e) => set("participants", e.target.value)} /></Field>
        <Field label="Contact / responsable"><input className="planner-field" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
      </div>
      <Field label="Matériel demandé" help={room?.equipmentList?.length ? `Disponible : ${room.equipmentList.join(", ")}` : undefined}><input className="planner-field" value={f.equipment} onChange={(e) => set("equipment", e.target.value)} /></Field>
      <Field label="Remarque"><textarea className="planner-field" rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
      <Field label="Note interne (non exportée)"><textarea className="planner-field" rows={2} value={f.internalNote} onChange={(e) => set("internalNote", e.target.value)} /></Field>
      {!editing && (
        <div className="row" style={{ alignItems: "flex-end", marginBottom: 6 }}>
          <Field label="Enregistrer comme modèle"><input className="planner-field" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Nom du modèle" /></Field>
          <div style={{ flex: "0 0 auto", marginBottom: 10 }}><button className="btn" onClick={saveTpl}>Enregistrer le modèle</button></div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit}>{editing ? "Enregistrer" : "Réserver"}</button>
      </div>
    </Modal>
  );
}
