import React, { useEffect, useRef } from "react";
import { styleFor } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { WEEKDAY_ABBR, MONTH_ABBR } from "../lib/planner/constants.js";
import { eachDay, monthMatrix, weekStart, addDays, todayKey, parseKey, frDayTitle } from "../lib/planner/dates.js";
import { sessionName, matchesFilters, conflictPairs, closureFor, vacationFor, groupByDay } from "../lib/planner/occurrences.js";
import { holidayName } from "../lib/planner/holidays.js";

const PINK = "#FBE4EC";
const hasNote = (n) => !!n && (n.opening || n.closing || n.absence || n.note);

export function NoteLines({ note }) {
  if (!hasNote(note)) return null;
  const L = { fontSize: 10, lineHeight: 1.3, color: "#5B3A29" };
  return (
    <div style={{ background: "#FFF6D8", border: "1px solid #EBD38A", borderRadius: 5, padding: "2px 5px", marginBottom: 3 }}>
      {note.opening && <div style={L}>🔑 Ouverture : <b>{note.opening}</b></div>}
      {note.closing && <div style={L}>🔒 Fermeture : <b>{note.closing}</b></div>}
      {note.absence && <div style={{ ...L, color: "#A32D2D" }}>⚠ Absent(e) : <b>{note.absence}</b></div>}
      {note.note && <div style={L}>📝 {note.note}</div>}
    </div>
  );
}

function DayNumber({ d, onNote, children }) {
  const P = usePlanner();
  const n = P.dayNoteFor(d);
  return (
    <button onClick={(e) => { e.stopPropagation(); onNote(d); }} title="Ajouter / modifier la note du jour" style={{ background: "none", border: "none", padding: "0 2px", font: "inherit", fontWeight: 700, cursor: "pointer", color: "inherit", borderRadius: 4, textDecoration: "underline dotted" }}>
      {children}{hasNote(n) && <span style={{ color: "#C98A00", marginLeft: 2 }}>●</span>}
    </button>
  );
}

// Un stage occupe plusieurs salles : on n'affiche qu'une pastille par jour dans les vues « Mois » et « Semaine »
function collapseStages(list, P) {
  const seen = new Set(); const out = [];
  for (const s of list) {
    if (!s.stageId) { out.push(s); continue; }
    if (seen.has(s.stageId)) continue;
    seen.add(s.stageId);
    const st = P.db.Stage.find((x) => x.id === s.stageId);
    out.push({ ...s, floorLabel: st ? st.floorName : "" });
  }
  return out;
}

function Chip({ s, P }) {
  const assoc = P.associations.find((a) => a.id === s.associationId);
  const room = P.rooms.find((r) => r.id === s.roomId);
  const st = styleFor(s, assoc, room);
  const name = sessionName(s, P.associations);
  const canDrag = !s.stageId;
  return (
    <div className="badge" draggable={canDrag} onDragStart={canDrag ? (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ id: s.id, date: s.date, roomId: s.roomId })); e.dataTransfer.effectAllowed = "move"; } : undefined} title={`${name} · ${s.start}–${s.end}${s.status === "a_confirmer" ? " · EN ATTENTE" : ""}${s.stageId ? " · Stage" : ""}`}
      style={{ background: st.bg, borderColor: s.status === "a_confirmer" ? "#E24B4A" : st.border, color: st.text, borderStyle: s.status === "a_confirmer" || s.stageId ? "dashed" : "solid", borderWidth: s.status === "a_confirmer" ? 2 : 1, textDecoration: s.status === "annule" ? "line-through" : "none", whiteSpace: "normal", overflow: "visible", lineHeight: 1.25, padding: "2px 5px" }}>
      <div style={{ fontWeight: 700 }}>{s.paymentStatus === "unpaid" && s.status !== "annule" && <span style={{ color: "#C0392B" }}>● </span>}{s.start}–{s.end}</div>
      <div style={{ wordBreak: "break-word" }}>{name}{s.floorLabel ? <span style={{ opacity: 0.8 }}> · {s.floorLabel}</span> : null}</div>
    </div>
  );
}

// Par salle : salles en lignes, jours en colonnes
const readDrag = (e) => { try { return JSON.parse(e.dataTransfer.getData("text/plain")); } catch (err) { return null; } };
export function RoomGridView({ range, filters, onCell, onNote, onDrop }) {
  const P = usePlanner();
  const days = eachDay(range.from, range.to);
  const w = days.length > 8 ? 118 : 150;
  const today = todayKey();
  const all = P.allSessions(range.from, range.to).filter((s) => matchesFilters(s, filters));
  const byDay = groupByDay(all);
  const anyNote = days.some((d) => hasNote(P.dayNoteFor(d)));
  const box = useRef(null);
  useEffect(() => { const el = box.current && box.current.querySelector("[data-today]"); if (el) box.current.scrollLeft = Math.max(0, el.offsetLeft - 190); else if (box.current) box.current.scrollLeft = 0; }, [range.from, range.to]);
  return (
    <div ref={box} className="planner-scroll" style={{ overflow: "auto", maxHeight: "70vh", border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }}>
      <table className="grid-table">
        <thead><tr><th className="corner">Salle</th>{days.map((d) => { const dd = parseKey(d); const hol = holidayName(d); const vac = vacationFor(P.vacations, d); return (
          <th key={d} data-today={d === today ? "1" : undefined} style={{ minWidth: w, maxWidth: w, background: d === today ? "#E3EFE9" : vac ? PINK : undefined }} title={[hol, vac && vac.label].filter(Boolean).join(" · ")}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{WEEKDAY_ABBR[(dd.getDay() + 6) % 7]}{vac ? " · vac." : ""}</div><div><DayNumber d={d} onNote={onNote}>{dd.getDate()}</DayNumber>{hol ? " ✦" : ""}</div></th>); })}</tr></thead>
        <tbody>
          {anyNote && <tr><td className="room" style={{ color: "var(--muted)", fontSize: 11 }}>Infos du jour</td>{days.map((d) => <td key={d} style={{ verticalAlign: "top", padding: 3, borderRight: "1px solid #EFE8D8", borderBottom: "1px solid #EFE8D8", minWidth: w, maxWidth: w }}><NoteLines note={P.dayNoteFor(d)} /></td>)}</tr>}
          {P.rooms.map((r) => (
            <tr key={r.id}>
              <td className="room">{r.name}</td>
              {days.map((d) => {
                const list = (byDay.get(d) || []).filter((s) => s.roomId === r.id);
                const closed = closureFor(P.closures, r.id, d);
                const vac = vacationFor(P.vacations, d);
                const conflict = conflictPairs(list, "same").length > 0;
                return (
                  <td key={d} className={"planner-cell" + (closed ? " hatch" : "")} style={{ height: "auto", minHeight: 54, minWidth: w, maxWidth: w, background: closed ? undefined : vac ? PINK : undefined, outline: conflict ? "2px solid #E24B4A" : "none", outlineOffset: -2 }}
                    title={closed ? `Fermée : ${closed.label}` : ""} onClick={() => onCell(d, r.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const dr = readDrag(e); if (dr && onDrop) onDrop(dr, d, r.id); }}>
                    {list.map((s) => <Chip key={s.id} s={s} P={P} />)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonthView({ date, filters, onDay, onNote, onDrop }) {
  const P = usePlanner();
  const weeks = monthMatrix(date);
  const cells = weeks.flat();
  const real = cells.filter(Boolean);
  const all = P.allSessions(real[0], real[real.length - 1]).filter((s) => matchesFilters(s, filters));
  const byDay = groupByDay(all);
  const today = todayKey();
  return (
    <div className="month-grid">
      {WEEKDAY_ABBR.map((d) => <div key={d} className="month-head">{d}</div>)}
      {cells.map((d, i) => {
        if (!d) return <div key={"e" + i} className="month-cell" style={{ background: "#F7F4EC", cursor: "default" }} />;
        const list = collapseStages(byDay.get(d) || [], P);
        const hol = holidayName(d);
        const vac = vacationFor(P.vacations, d);
        const closedAll = P.closures.find((c) => !c.roomId && c.startDate <= d && d <= c.endDate);
        return (
          <div key={d} className="month-cell" style={{ background: d === today ? "#E3EFE9" : closedAll || vac ? PINK : hol ? "#FBF3E0" : undefined }} onClick={() => onDay(d)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const dr = readDrag(e); if (dr && onDrop) onDrop(dr, d, dr.roomId); }}>
            <div style={{ fontSize: 12 }}><DayNumber d={d} onNote={onNote}>{parseKey(d).getDate()}</DayNumber></div>
            {(hol || vac || closedAll) && <div className="help" style={{ fontSize: 10 }}>{[hol, closedAll && `Fermé : ${closedAll.label}`, vac && vac.label].filter(Boolean).join(" · ")}</div>}
            <NoteLines note={P.dayNoteFor(d)} />
            {list.slice(0, 4).map((s) => <Chip key={s.id} s={s} P={P} />)}
            {list.length > 4 && <div className="help">+{list.length - 4} autres</div>}
          </div>
        );
      })}
    </div>
  );
}

export function WeekView({ date, filters, onDay, onNote }) {
  const P = usePlanner();
  const ws = weekStart(date);
  const days = eachDay(ws, addDays(ws, 6));
  const all = P.allSessions(ws, addDays(ws, 6)).filter((s) => matchesFilters(s, filters));
  const byDay = groupByDay(all);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
      {days.map((d, i) => { const vac = vacationFor(P.vacations, d); return (
        <div key={d} className="card" style={{ padding: 8, cursor: "pointer", background: d === todayKey() ? "#E3EFE9" : vac ? PINK : "#fff" }} onClick={() => onDay(d)}>
          <div className="eyebrow">{WEEKDAY_ABBR[i]} <DayNumber d={d} onNote={onNote}>{parseKey(d).getDate()}</DayNumber> {MONTH_ABBR[parseKey(d).getMonth()]}</div>
          {(holidayName(d) || vac) && <div className="help">{[holidayName(d), vac && vac.label].filter(Boolean).join(" · ")}</div>}
          <NoteLines note={P.dayNoteFor(d)} />
          {collapseStages(byDay.get(d) || [], P).map((s) => { const r = P.rooms.find((x) => x.id === s.roomId); return <div key={s.id} style={{ marginTop: 4 }}><Chip s={s} P={P} />{!s.stageId && <div className="help" style={{ fontSize: 10, marginTop: -2 }}>{r?.name}</div>}</div>; })}
        </div>); })}
    </div>
  );
}

export function DayAgendaView({ date, filters, onDay, onNote }) {
  const P = usePlanner();
  const list = P.allSessions(date, date).filter((s) => matchesFilters(s, filters));
  const vac = vacationFor(P.vacations, date);
  return (
    <div className="card" style={{ background: vac ? PINK : "#fff" }}>
      <h3 className="serif" style={{ marginBottom: 8 }}>{frDayTitle(date)} <button className="link" onClick={() => onNote(date)}>Note du jour</button></h3>
      {holidayName(date) && <div className="banner banner-amber">{holidayName(date)}</div>}
      {vac && <div className="help" style={{ marginBottom: 6 }}>{vac.label}</div>}
      <NoteLines note={P.dayNoteFor(date)} />
      {list.length === 0 && <p className="help">Aucune réservation ce jour.</p>}
      {list.map((s) => { const r = P.rooms.find((x) => x.id === s.roomId); return (
        <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}>
          <div style={{ flex: 1 }}><Chip s={s} P={P} /></div><span className="help" style={{ width: 150 }}>{r?.name}</span>
        </div>); })}
      <button className="link" onClick={() => onDay(date)}>Ouvrir le détail du jour</button>
    </div>
  );
}
