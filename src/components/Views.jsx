import React from "react";
import { styleFor } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { WEEKDAY_ABBR, MONTH_ABBR } from "../lib/planner/constants.js";
import { eachDay, monthBounds, monthMatrix, weekStart, addDays, todayKey, parseKey, frDayTitle } from "../lib/planner/dates.js";
import { sessionName, matchesFilters, conflictPairs, closureFor, groupByDay } from "../lib/planner/occurrences.js";
import { holidayName } from "../lib/planner/holidays.js";

const label = (s, P) => `${s.start} ${sessionName(s, P.associations)}`;

function Chip({ s, P }) {
  const assoc = P.associations.find((a) => a.id === s.associationId);
  const room = P.rooms.find((r) => r.id === s.roomId);
  const st = styleFor(s, assoc, room);
  return (
    <div className="badge" title={`${sessionName(s, P.associations)} · ${s.start}–${s.end}${s.status === "a_confirmer" ? " · EN ATTENTE" : ""}`}
      style={{ background: st.bg, borderColor: s.status === "a_confirmer" ? "#E24B4A" : st.border, color: st.text, borderStyle: s.status === "a_confirmer" ? "dashed" : "solid", borderWidth: s.status === "a_confirmer" ? 2 : 1, textDecoration: s.status === "annule" ? "line-through" : "none" }}>
      {s.paymentStatus === "unpaid" && s.status !== "annule" && <span style={{ color: "#C0392B" }}>● </span>}{label(s, P)}
    </div>
  );
}

// Par salle : salles en lignes, jours du mois en colonnes (72 px) ou de la semaine (108 px)
export function RoomGridView({ range, filters, onCell }) {
  const P = usePlanner();
  const days = eachDay(range.from, range.to);
  const w = days.length > 8 ? 72 : 108;
  const today = todayKey();
  const all = P.allSessions(range.from, range.to).filter((s) => matchesFilters(s, filters));
  const byDay = groupByDay(all);
  return (
    <div className="planner-scroll" style={{ overflow: "auto", maxHeight: "68vh", border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }}>
      <table className="grid-table">
        <thead><tr><th className="corner">Salle</th>{days.map((d) => { const dd = parseKey(d); const hol = holidayName(d); return (
          <th key={d} style={{ minWidth: w, maxWidth: w, background: d === today ? "#E3EFE9" : undefined }} title={hol || ""}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{WEEKDAY_ABBR[(dd.getDay() + 6) % 7]}</div><div>{dd.getDate()}{hol ? " ✦" : ""}</div></th>); })}</tr></thead>
        <tbody>
          {P.rooms.map((r) => (
            <tr key={r.id}>
              <td className="room">{r.name}</td>
              {days.map((d) => {
                const list = (byDay.get(d) || []).filter((s) => s.roomId === r.id);
                const closed = closureFor(P.closures, r.id, d);
                const conflict = conflictPairs(list, "same").length > 0;
                return (
                  <td key={d} className={"planner-cell" + (closed ? " hatch" : "")} style={{ minWidth: w, maxWidth: w, outline: conflict ? "2px solid #E24B4A" : "none", outlineOffset: -2 }}
                    title={closed ? `Fermée : ${closed.label}` : ""} onClick={() => onCell(d, r.id)}>
                    {list.slice(0, 3).map((s) => <Chip key={s.id} s={s} P={P} />)}
                    {list.length > 3 && <div className="help">+{list.length - 3}</div>}
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

export function MonthView({ date, filters, onDay }) {
  const P = usePlanner();
  const cells = monthMatrix(date);
  const mb = monthBounds(date);
  const from = cells[0], to = cells[cells.length - 1];
  const all = P.allSessions(from, to).filter((s) => matchesFilters(s, filters));
  const byDay = groupByDay(all);
  const today = todayKey();
  return (
    <div className="month-grid">
      {WEEKDAY_ABBR.map((d) => <div key={d} className="month-head">{d}</div>)}
      {cells.map((d) => {
        const list = byDay.get(d) || [];
        const inMonth = d >= mb.start && d <= mb.end;
        const hol = holidayName(d);
        const note = P.dayNoteFor(d);
        return (
          <div key={d} className="month-cell" style={{ opacity: inMonth ? 1 : 0.45, background: d === today ? "#E3EFE9" : hol ? "#FBF3E0" : undefined }} onClick={() => onDay(d)}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600 }}><span>{parseKey(d).getDate()}</span>{note?.presence && <span className="help" title="Présence">{note.presence}</span>}</div>
            {hol && <div className="help" style={{ fontSize: 10 }}>{hol}</div>}
            {note?.note && <div className="help" style={{ fontSize: 10 }}>📝 {note.note}</div>}
            {list.slice(0, 3).map((s) => <Chip key={s.id} s={s} P={P} />)}
            {list.length > 3 && <div className="help">+{list.length - 3} autres</div>}
          </div>
        );
      })}
    </div>
  );
}

export function WeekView({ date, filters, onDay }) {
  const P = usePlanner();
  const ws = weekStart(date);
  const days = eachDay(ws, addDays(ws, 6));
  const all = P.allSessions(ws, addDays(ws, 6)).filter((s) => matchesFilters(s, filters));
  const byDay = groupByDay(all);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
      {days.map((d) => (
        <div key={d} className="card" style={{ padding: 8, cursor: "pointer", background: d === todayKey() ? "#E3EFE9" : "#fff" }} onClick={() => onDay(d)}>
          <div className="eyebrow">{WEEKDAY_ABBR[days.indexOf(d)]} {parseKey(d).getDate()} {MONTH_ABBR[parseKey(d).getMonth()]}</div>
          {holidayName(d) && <div className="help">{holidayName(d)}</div>}
          {(byDay.get(d) || []).map((s) => { const r = P.rooms.find((x) => x.id === s.roomId); return <div key={s.id} style={{ marginTop: 4 }}><Chip s={s} P={P} /><div className="help" style={{ fontSize: 10, marginTop: -2 }}>{r?.name}</div></div>; })}
        </div>
      ))}
    </div>
  );
}

export function DayAgendaView({ date, filters, onDay }) {
  const P = usePlanner();
  const list = P.allSessions(date, date).filter((s) => matchesFilters(s, filters));
  return (
    <div className="card">
      <h3 className="serif" style={{ marginBottom: 8 }}>{frDayTitle(date)}</h3>
      {holidayName(date) && <div className="banner banner-amber">{holidayName(date)}</div>}
      {list.length === 0 && <p className="help">Aucune réservation ce jour.</p>}
      {list.map((s) => { const r = P.rooms.find((x) => x.id === s.roomId); return (
        <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}>
          <b style={{ width: 90 }}>{s.start}–{s.end}</b><div style={{ flex: 1 }}><Chip s={s} P={P} /></div><span className="help" style={{ width: 150 }}>{r?.name}</span>
        </div>); })}
      <button className="link" onClick={() => onDay(date)}>Ouvrir le détail du jour</button>
    </div>
  );
}
