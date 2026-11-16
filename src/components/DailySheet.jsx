import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { frDayTitle } from "../lib/planner/dates.js";
import { sessionName, activeSessions, stageTitle } from "../lib/planner/occurrences.js";
import { canSavePdf, savePdf, printDoc } from "../lib/planner/sync.js";
import { sheetTime } from "../lib/planner/format.js";

export function PrintLayer({ onClose, children, title, extra, pdfName, simplex }) {
  useEffect(() => {
    document.body.classList.add("invoice-printing");
    return () => document.body.classList.remove("invoice-printing");
  }, []);
  return createPortal(
    <div className="print-layer">
      <div className="print-toolbar no-print">
        <span className="help" style={{ marginRight: "auto", alignSelf: "center" }}>{title}</span>
        {extra}
        {canSavePdf() && <button className="btn btn-primary" onClick={async () => { const r = await savePdf(pdfName || "document"); }}>Enregistrer en PDF</button>}
        <button className={"btn" + (canSavePdf() ? "" : " btn-primary")} onClick={() => printDoc({ simplex: !!simplex })}>Imprimer</button>
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
      {children}
    </div>,
    document.body
  );
}

// Nom en très gros : la taille diminue seulement si le nom ne tient pas sur la largeur de la page
function FitName({ text }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let size = 80; el.style.whiteSpace = "nowrap"; el.style.fontSize = size + "px";
    while (size > 40 && el.scrollWidth > el.clientWidth) { size -= 2; el.style.fontSize = size + "px"; }
    if (el.scrollWidth > el.clientWidth) el.style.whiteSpace = "normal"; // nom vraiment très long : deux lignes
  }, [text]);
  return <div ref={ref} className="sheet-name">{text}</div>;
}

const PER_PAGE = 6;

export default function DailySheet({ date, onClose }) {
  const P = usePlanner();
  const [floor, setFloor] = React.useState("all");
  const floorRooms = floor === "all" ? null : P.floorRoomIds(P.floors.find((f) => f.name === floor) || { roomNames: [] });
  const raw = activeSessions(P.allSessions(date, date)).filter((s) => !floorRooms || floorRooms.includes(s.roomId)).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  // Un stage occupe plusieurs salles : une seule case « BAFA … · 3e étage »
  const list = []; const seen = new Set();
  for (const s of raw) {
    if (!s.stageId) { list.push({ s }); continue; }
    if (seen.has(s.stageId)) continue; seen.add(s.stageId);
    const st = P.db.Stage.find((x) => x.id === s.stageId);
    list.push({ s, stage: st, rooms: raw.filter((x) => x.stageId === s.stageId).map((x) => P.rooms.find((r) => r.id === x.roomId)).filter(Boolean) });
  }
  const pages = [];
  for (let i = 0; i < list.length; i += PER_PAGE) pages.push(list.slice(i, i + PER_PAGE));
  if (pages.length === 0) pages.push([]);
  return (
    <PrintLayer simplex onClose={onClose} title={`Fiche du jour · ${frDayTitle(date)} · ${pages.length} page(s), recto seul`} pdfName={`fiche-du-jour-${date}`} extra={<select className="planner-field" style={{ width: 170 }} value={floor} onChange={(e) => setFloor(e.target.value)}><option value="all">Toutes les salles</option>{P.floors.map((f) => <option key={f.name} value={f.name}>{f.statementLabel || f.name}</option>)}</select>}>
      {pages.map((pg, i) => (
        <div key={i} className={"sheet-page" + (i < pages.length - 1 ? " sheet-break" : "")}>
          <div className="sheet-day serif">{frDayTitle(date)}</div>
          {P.dayNoteFor(date)?.closed && <p style={{ textAlign: "center", fontWeight: 700, fontSize: 18, margin: "10px 0" }}>Maison fermée ce jour</p>}
          {pg.length === 0 && <p className="help">Aucune activité prévue ce jour.</p>}
          {pg.map(({ s, stage, rooms }) => {
            const room = P.rooms.find((r) => r.id === s.roomId);
            const multi = stage && rooms.length > 1;
            return (
              <div key={s.id} className="sheet-box">
                <FitName text={stage ? stageTitle(stage, P.associations) : sessionName(s, P.associations)} />
                {multi ? <>
                  <div className="sheet-room">{(stage.floorName || "Étage").replace(/étage/i, "ÉTAGE").replace(/sous-sol/i, "SOUS-SOL")} <span className="sheet-time">· {sheetTime(s.start)} 🕐 {sheetTime(s.end)}</span></div>
                  <div className="sheet-access">Salles {rooms.map((r) => r.name).sort((a, b) => a.localeCompare(b, "fr")).join(" et ")}</div>
                </> : <>
                  <div className="sheet-room">Salle {(room?.name || "").toUpperCase()} <span className="sheet-time">· {sheetTime(s.start)} 🕐 {sheetTime(s.end)}</span></div>
                  {room?.accessInfo && <div className="sheet-access">{room.accessInfo}</div>}
                </>}
              </div>
            );
          })}
        </div>
      ))}
    </PrintLayer>
  );
}
