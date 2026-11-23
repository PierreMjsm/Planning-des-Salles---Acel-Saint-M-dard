import React, { useState } from "react";
import { Modal, TimeInput, DateInput } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { AVAIL_START, AVAIL_END } from "../lib/planner/constants.js";
import { activeSessions, timesOverlap, closureFor } from "../lib/planner/occurrences.js";
import { frLong, capitalize } from "../lib/planner/dates.js";

export default function AvailabilityModal({ date, onClose }) {
  const P = usePlanner();
  const [d, setD] = useState(date);
  const [s, setS] = useState(AVAIL_START);
  const [e, setE] = useState(AVAIL_END);
  const day = activeSessions(P.allSessions(d, d));
  const free = P.rooms.filter((r) => !closureFor(P.closures, r.id, d) && !day.some((x) => x.roomId === r.id && timesOverlap(x.start, x.end, s, e)));
  return (
    <Modal title="Disponibilités" subtitle="Salles libres sur un créneau" onClose={onClose} width={560}>
      <div className="row">
        <div><label className="lbl">Jour</label><DateInput value={d} onChange={setD} /></div>
        <div><label className="lbl">De</label><TimeInput value={s} onChange={setS} /></div>
        <div><label className="lbl">À</label><TimeInput value={e} onChange={setE} /></div>
      </div>
      <p className="help" style={{ margin: "12px 0 6px" }}>{capitalize(frLong(d))} · {s}–{e}</p>
      {free.length === 0 ? <p>Aucune salle libre sur ce créneau.</p> : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{free.map((r) => <span key={r.id} className="tag tag-green">{r.name}{r.capacity ? ` · ${r.capacity} pers.` : ""}</span>)}</div>
      )}
    </Modal>
  );
}
