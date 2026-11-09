import React, { useEffect } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { HOUSE_TITLE } from "../lib/planner/constants.js";
import { frDayTitle } from "../lib/planner/dates.js";
import { sessionName, activeSessions } from "../lib/planner/occurrences.js";
import { sheetTime } from "../lib/planner/format.js";

export function PrintLayer({ onClose, children, title }) {
  useEffect(() => {
    document.body.classList.add("invoice-printing");
    return () => document.body.classList.remove("invoice-printing");
  }, []);
  return (
    <div className="print-layer">
      <div className="print-toolbar no-print">
        <span className="help" style={{ marginRight: "auto", alignSelf: "center" }}>{title}</span>
        <button className="btn btn-primary" onClick={() => window.print()}>Imprimer / Enregistrer en PDF</button>
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
      {children}
    </div>
  );
}

export default function DailySheet({ date, onClose }) {
  const P = usePlanner();
  const list = activeSessions(P.allSessions(date, date)).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  const pages = [];
  for (let i = 0; i < list.length; i += 5) pages.push(list.slice(i, i + 5));
  if (pages.length === 0) pages.push([]);
  return (
    <PrintLayer onClose={onClose} title={`Fiche du jour · ${frDayTitle(date)}`}>
      {pages.map((pg, i) => (
        <div key={i} className={"sheet-page" + (i < pages.length - 1 ? " sheet-break" : "")}>
          <div className="sheet-house serif">{HOUSE_TITLE}</div>
          <div className="sheet-day serif">{frDayTitle(date)}</div>
          {pg.length === 0 && <p className="help">Aucune activité prévue ce jour.</p>}
          {pg.map((s) => {
            const room = P.rooms.find((r) => r.id === s.roomId);
            return (
              <div key={s.id} className="sheet-box">
                <div className="sheet-name">{sessionName(s, P.associations)}</div>
                <div className="sheet-time">{sheetTime(s.start)} 🕐 {sheetTime(s.end)}</div>
                <div className="sheet-room">Salle {(room?.name || "").toUpperCase()}</div>
                {room?.accessInfo && <div className="sheet-access">{room.accessInfo}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </PrintLayer>
  );
}
