import React, { useMemo, useState } from "react";
import { Modal, Field, DateInput } from "./ui.jsx";
import { PrintLayer } from "./DailySheet.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { HOUSE_TITLE } from "../lib/planner/constants.js";
import { eachDay, frDayTitle, frShort, capitalize } from "../lib/planner/dates.js";
import { activeSessions, sessionName } from "../lib/planner/occurrences.js";
import { closureFor, vacationFor } from "../lib/planner/occurrences.js";

// Planning « officiel » à imprimer : une salle par page, ou un jour après l'autre (toutes les salles)
export default function PrintPlanning({ range, onClose }) {
  const P = usePlanner();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [mode, setMode] = useState("room");
  const [roomIds, setRoomIds] = useState(() => P.rooms.map((r) => r.id));
  const [go, setGo] = useState(false);
  const days = useMemo(() => (to >= from ? eachDay(from, to) : []), [from, to]);
  const all = useMemo(() => activeSessions(P.allSessions(from, to)).filter((s) => roomIds.includes(s.roomId)).sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1)), [from, to, roomIds, P.allSessions]);
  const title = from === to ? capitalize(frDayTitle(from)) : `Du ${frShort(from)} au ${frShort(to)}`;
  const row = (s, withRoom) => <div key={s.id} style={{ display: "flex", gap: 10, padding: "2px 0", fontSize: 13 }}><b style={{ width: 100 }}>{s.start}–{s.end}</b><span style={{ flex: 1 }}>{sessionName(s, P.associations)}</span>{withRoom && <span style={{ width: 170, color: "#555" }}>{P.rooms.find((r) => r.id === s.roomId)?.name}</span>}</div>;

  if (go) return (
    <PrintLayer onClose={onClose} title={`Planning · ${title}`}>
      <div className="sheet-page" style={{ textAlign: "left", width: 760 }}>
        <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
        {mode === "room" ? P.rooms.filter((r) => roomIds.includes(r.id)).map((r, i, arr) => (
          <div key={r.id} className={i < arr.length - 1 ? "sheet-break" : ""} style={{ marginBottom: 24 }}>
            <div className="sheet-house" style={{ textAlign: "center" }}>{HOUSE_TITLE}</div>
            <h2 style={{ fontSize: 22, margin: "6px 0 2px" }}>Salle {r.name}</h2>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>{title}</div>
            {days.map((d) => {
              const list = all.filter((s) => s.roomId === r.id && s.date === d);
              const closed = closureFor(P.closures, r.id, d);
              if (!list.length && !closed) return null;
              return <div key={d} style={{ borderTop: "1px solid #ccc", padding: "4px 0", display: "flex", gap: 10 }}><b style={{ width: 130, fontSize: 13 }}>{capitalize(frShort(d))}</b><div style={{ flex: 1 }}>{closed && <div style={{ fontSize: 13, color: "#a33" }}>Fermée : {closed.label}</div>}{list.map((s) => row(s, false))}</div></div>;
            })}
            {all.filter((s) => s.roomId === r.id).length === 0 && <p style={{ color: "#777", fontSize: 13 }}>Aucune réservation sur la période.</p>}
          </div>
        )) : (
          <div>
            <div className="sheet-house" style={{ textAlign: "center" }}>{HOUSE_TITLE}</div>
            <h2 style={{ fontSize: 20, margin: "6px 0 10px", textAlign: "center" }}>Planning des salles · {title}</h2>
            {days.map((d) => {
              const list = all.filter((s) => s.date === d); const vac = vacationFor(P.vacations, d);
              if (!list.length) return null;
              return <div key={d} style={{ borderTop: "1px solid #ccc", padding: "6px 0", breakInside: "avoid" }}><b style={{ fontSize: 14 }}>{capitalize(frDayTitle(d))}{vac ? ` · ${vac.label}` : ""}</b>{list.map((s) => row(s, true))}</div>;
            })}
            {all.length === 0 && <p style={{ color: "#777" }}>Aucune réservation sur la période.</p>}
          </div>
        )}
      </div>
    </PrintLayer>
  );
  return (
    <Modal title="Imprimer le planning" subtitle="Planning officiel à afficher ou à envoyer" onClose={onClose} width={520}>
      <div className="row"><Field label="Du"><DateInput value={from} onChange={setFrom} /></Field><Field label="Au"><DateInput value={to} onChange={setTo} /></Field></div>
      <Field label="Présentation"><div className="seg"><button className={mode === "room" ? "on" : ""} onClick={() => setMode("room")}>Une salle par page</button><button className={mode === "day" ? "on" : ""} onClick={() => setMode("day")}>Jour par jour</button></div></Field>
      <Field label="Salles">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="link" onClick={() => setRoomIds(P.rooms.map((r) => r.id))}>Toutes</button><button className="link" onClick={() => setRoomIds([])}>Aucune</button>
          {P.rooms.map((r) => <label key={r.id} style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, padding: "3px 7px", background: roomIds.includes(r.id) ? "var(--primary-soft)" : "#fff" }}><input type="checkbox" checked={roomIds.includes(r.id)} onChange={(e) => setRoomIds(e.target.checked ? [...roomIds, r.id] : roomIds.filter((x) => x !== r.id))} /> {r.name}</label>)}
        </div>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!days.length || !roomIds.length} onClick={() => setGo(true)}>Aperçu et impression</button></div>
    </Modal>
  );
}
