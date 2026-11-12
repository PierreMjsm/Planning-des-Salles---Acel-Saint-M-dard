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
    P.saveStage({ kind, label, floor, dates, associationId, customName: (associationId ? "" : customName.trim()) || label, status, paymentStatus, start, end, dayPrice, params: { startDate, count: n, skipWeekend, skipWed } }, stage ? stage.id : undefined);
    onClose();
  };
  // Lieux proposés : les étages (1er, 2e, 3e) puis les salles seules (Bords de Bièvre, Carré Censier)
  const places = [...P.floors].sort((a, b) => { const rank = (f) => (/^\d.*étage/i.test(f.name) ? parseInt(f.name, 10) : 99); return rank(a) - rank(b); });
  const placeLabel = (f) => ((f.roomNames || []).length === 1 ? "Salle " + f.roomNames[0] : f.name);
  const roomsOf = (f) => P.floorRoomIds(f).map((id) => P.rooms.find((r) => r.id === id)?.name).filter(Boolean);
  const Choice = ({ on, onClick, title, sub }) => (
    <button type="button" className={"choice" + (on ? " on" : "")} aria-pressed={on} onClick={onClick}><b>{title}</b>{sub ? <span>{sub}</span> : null}</button>
  );
  return (
    <Modal title={stage ? "Modifier la réservation d'étage" : "Réserver un étage (stage BAFA…)"} subtitle="Bloque toutes les salles de l'étage, à prix fixe par jour" onClose={onClose} width={660}>
      {clashes > 0 && <div className="banner banner-red"><b>{clashes} séance(s)</b> déjà réservée(s) à cet endroit pendant ces dates.</div>}
      <div className="row">
        <Field label="Qui réserve ?"><select className="planner-field" value={associationId} onChange={(e) => setAssoc(e.target.value)}><option value="">— Nom libre —</option>{P.associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        {!associationId && <Field label="Nom libre"><input className="planner-field" value={customName} onChange={(e) => setCustom(e.target.value)} placeholder="Ex. BAFA AFOCAL" /></Field>}
      </div>
      <div className="lbl" style={{ marginTop: 4 }}>Où ?</div>
      <div className="choices" role="group" aria-label="Lieu">
        {places.map((f) => <Choice key={f.name} on={f.name === floorName} onClick={() => { setFloorName(f.name); setPrice(null); }} title={placeLabel(f)} sub={(f.roomNames || []).length > 1 ? roomsOf(f).join(" + ") || "aucune salle" : `${f.price || 0} € / jour`} />)}
      </div>
      <div className="lbl" style={{ marginTop: 10 }}>Combien de jours ?</div>
      <div className="choices" role="group" aria-label="Durée">
        <Choice on={kind === "base"} onClick={() => pickKind("base")} title="8 jours" sub="BAFA Base" />
        <Choice on={kind === "approf"} onClick={() => pickKind("approf")} title="6 jours" sub="BAFA Approfondissement" />
        <Choice on={kind === "custom"} onClick={() => pickKind("custom")} title="Autre durée" sub="Autre réservation d'étage" />
        {kind === "custom" && <div style={{ width: 90 }}><NumInput value={count} onChange={setCount} /></div>}
      </div>
      <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
        <Field label="Premier jour"><DateInput value={startDate} onChange={setStartDate} /></Field>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingBottom: 10 }}>
          <label style={{ fontSize: 14 }}><input type="checkbox" checked={skipWeekend} onChange={(e) => setSkipWeekend(e.target.checked)} /> Sans week-end</label>
          <label style={{ fontSize: 14 }}><input type="checkbox" checked={skipWed} onChange={(e) => setSkipWed(e.target.checked)} /> Sans mercredi</label>
        </div>
      </div>
      <div style={{ background: "var(--bg-soft, #f4f2ec)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
        <div style={{ fontSize: 13 }}><b>{dates.length} jour(s)</b> · {roomsOf(floor).join(" + ") || "aucune salle"} · {start}–{end}</div>
        <div className="help">{dates.map(frShort).join(" · ")}</div>
      </div>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label="Prix fixe par jour (€)"><NumInput decimal value={price === null ? String(floor.price || 0) : price} onChange={setPrice} /></Field>
        <div style={{ paddingBottom: 10, fontSize: 15 }}>Total : <b>{fmtMoney(dayPrice * dates.length)}</b></div>
      </div>
      <details style={{ marginBottom: 10 }} open={!!stage && (status !== "confirme" || paymentStatus !== "unpaid" || start !== STAGE_START || end !== STAGE_END)}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>Plus d'options (horaires, validation, paiement)</summary>
        <div className="row" style={{ marginTop: 8 }}>
          <Field label="Début"><TimeInput value={start} onChange={setStart} /></Field>
          <Field label="Fin"><TimeInput value={end} onChange={setEnd} /></Field>
          <Field label="Validation"><select className="planner-field" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Paiement"><select className="planner-field" value={paymentStatus} onChange={(e) => setPay(e.target.value)}>{Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
      </details>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={submit}>{stage ? "Enregistrer" : "Réserver l'étage"}</button></div>
    </Modal>
  );
}
