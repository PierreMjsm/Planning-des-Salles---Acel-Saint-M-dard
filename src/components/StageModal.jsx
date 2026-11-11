import React, { useMemo, useState } from "react";
import { Modal, Field, TimeInput, DateInput, NumInput } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { STAGE_KINDS, STAGE_START, STAGE_END, STATUS_LABELS, PAYMENT_LABELS } from "../lib/planner/constants.js";
import { addDays, weekdayIndex, frShort, schoolYearOf } from "../lib/planner/dates.js";
import { activeSessions, timesOverlap } from "../lib/planner/occurrences.js";
import { fmtMoney } from "../lib/planner/format.js";

export function stageDates(startDate, count, skipWeekend, skipWed) {
  const out = [];
  let d = startDate, guard = 0;
  while (out.length < count && guard < 400) {
    const w = weekdayIndex(d);
    if (!(skipWeekend && w >= 5) && !(skipWed && w === 2)) out.push(d);
    d = addDays(d, 1); guard++;
  }
  return out;
}

export default function StageModal({ initialDate, stage, onClose }) {
  const P = usePlanner();
  const pr = (stage && stage.params) || {};
  const [kind, setKind] = useState(stage ? stage.kind : "base");
  const [count, setCount] = useState(stage ? String(pr.count || stage.dates.length) : String(STAGE_KINDS.base.days));
  const [floorName, setFloorName] = useState(stage ? stage.floorName : P.floors[0].name);
  const [startDate, setStartDate] = useState(stage ? pr.startDate || stage.dates[0] : initialDate);
  const [skipWeekend, setSkipWeekend] = useState(!!pr.skipWeekend);
  const [skipWed, setSkipWed] = useState(!!pr.skipWed);
  const [associationId, setAssoc] = useState(stage ? stage.associationId || "" : "");
  const [customName, setCustom] = useState(stage && stage.customName !== stage.label ? stage.customName || "" : "");
  const [status, setStatus] = useState(stage ? stage.status : "confirme");
  const [paymentStatus, setPay] = useState(stage ? stage.paymentStatus : "unpaid");
  const [start, setStart] = useState(stage ? stage.start : STAGE_START);
  const [end, setEnd] = useState(stage ? stage.end : STAGE_END);
  const floor = P.floors.find((f) => f.name === floorName) || P.floors[0];
  const [price, setPrice] = useState(stage ? String(stage.dayPrice) : null);
  const dayPrice = price === null ? floor.price || 0 : Number(String(price).replace(",", ".")) || 0;
  const n = Math.max(1, Number(count) || 1);
  const dates = useMemo(() => stageDates(startDate, n, skipWeekend, skipWed), [startDate, n, skipWeekend, skipWed]);
  const roomIds = P.floorRoomIds(floor);
  const label = STAGE_KINDS[kind].label;

  const clashes = useMemo(() => {
    if (!dates.length) return 0;
    const all = activeSessions(P.allSessions(dates[0], dates[dates.length - 1]));
    return all.filter((s) => s.stageId !== (stage && stage.id) && roomIds.includes(s.roomId) && dates.includes(s.date) && timesOverlap(s.start, s.end, start, end)).length;
  }, [dates, roomIds, start, end, P.allSessions]);

  const pickKind = (k) => { setKind(k); setCount(String(STAGE_KINDS[k].days)); };
  const submit = () => {
    if (!associationId && !customName.trim()) return P.notify("Choisissez une association ou saisissez un nom", "error");
    if (roomIds.length === 0) return P.notify("Aucune salle n'est rattachée à cet étage (Réglages → Stages)", "error");
    if (!dates.length) return P.notify("Aucune date", "error");
    P.saveStage({ kind, label, floor, dates, associationId, customName: customName.trim() || label, status, paymentStatus, start, end, dayPrice, params: { startDate, count: n, skipWeekend, skipWed } }, stage ? stage.id : undefined);
    onClose();
  };
  return (
    <Modal title={stage ? "Modifier le stage" : "Nouveau stage BAFA"} subtitle="Occupe tout un étage, de 9h à 18h" onClose={onClose} width={640}>
      {clashes > 0 && <div className="banner banner-red"><b>{clashes} séance(s)</b> déjà réservée(s) sur cet étage pendant ces dates.</div>}
      <div className="row">
        <Field label="Type de stage"><select className="planner-field" value={kind} onChange={(e) => pickKind(e.target.value)}>{Object.entries(STAGE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}{k !== "custom" ? ` (${v.days} jours)` : ""}</option>)}</select></Field>
        <Field label="Nombre de jours"><NumInput value={count} onChange={setCount} /></Field>
      </div>
      <div className="row">
        <Field label="Association / organisme"><select className="planner-field" value={associationId} onChange={(e) => setAssoc(e.target.value)}><option value="">— Nom libre —</option>{P.associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Nom libre"><input className="planner-field" disabled={!!associationId} value={customName} onChange={(e) => setCustom(e.target.value)} placeholder={label} /></Field>
      </div>
      <div className="row">
        <Field label="Étage" help={`${roomIds.map((id) => P.rooms.find((r) => r.id === id)?.name).join(", ") || "aucune salle"}`}><select className="planner-field" value={floorName} onChange={(e) => { setFloorName(e.target.value); setPrice(null); }}>{P.floors.map((f) => <option key={f.name}>{f.name}</option>)}</select></Field>
        <Field label="Prix par jour (€)" help={`Total : ${fmtMoney(dayPrice * dates.length)}`}><NumInput decimal value={price === null ? String(floor.price || 0) : price} onChange={setPrice} /></Field>
      </div>
      <div className="row">
        <Field label="Premier jour"><DateInput value={startDate} onChange={setStartDate} /></Field>
        <Field label="Début"><TimeInput value={start} onChange={setStart} /></Field>
        <Field label="Fin"><TimeInput value={end} onChange={setEnd} /></Field>
      </div>
      <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
        <b style={{ fontSize: 13 }}>Jours non consécutifs (« en pointillé »)</b>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={skipWeekend} onChange={(e) => setSkipWeekend(e.target.checked)} /> Sans week-end</label>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={skipWed} onChange={(e) => setSkipWed(e.target.checked)} /> Sans mercredi</label>
        </div>
      </div>
      <p className="help" style={{ marginBottom: 10 }}><b>{dates.length} jour(s) :</b> {dates.map(frShort).join(" · ")}</p>
      <div className="row">
        <Field label="Validation"><select className="planner-field" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Paiement"><select className="planner-field" value={paymentStatus} onChange={(e) => setPay(e.target.value)}>{Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={submit}>{stage ? "Enregistrer" : "Créer le stage"}</button></div>
    </Modal>
  );
}
