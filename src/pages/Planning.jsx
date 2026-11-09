import React, { useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { RoomGridView, MonthView, WeekView, DayAgendaView } from "../components/Views.jsx";
import DayModal from "../components/DayModal.jsx";
import BookingForm from "../components/BookingForm.jsx";
import AvailabilityModal from "../components/AvailabilityModal.jsx";
import DailySheet from "../components/DailySheet.jsx";
import { STATUS_LABELS, PAYMENT_LABELS } from "../lib/planner/constants.js";
import { addDays, addMonths, monthBounds, weekStart, monthTitle, frDayTitle, todayKey, frShort, schoolYearOf } from "../lib/planner/dates.js";
import { sessionName, matchesFilters, conflictPairs, conflictText, activeSessions } from "../lib/planner/occurrences.js";
import { DateInput } from "../components/ui.jsx";
import { download, planningCsv, planningIcs } from "../lib/planner/exports.js";

const NORM = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Planning() {
  const P = usePlanner();
  const [view, setView] = useState("room");
  const [filters, setFilters] = useState({ assoc: "all", room: "all", status: "all", payment: "all", moment: "all" });
  const [search, setSearch] = useState("");
  const [dayModal, setDayModal] = useState(null);
  const [form, setForm] = useState(null);
  const [showAvail, setShowAvail] = useState(false);
  const [sheet, setSheet] = useState(false);
  const date = P.date;
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const step = (dir) => {
    if (view === "month" || view === "room") P.setDate(addMonths(date, dir));
    else if (view === "week") P.setDate(addDays(date, 7 * dir));
    else P.setDate(addDays(date, dir));
  };
  const mb = monthBounds(date);
  const ws = weekStart(date);
  const range = view === "week" ? { from: ws, to: addDays(ws, 6) } : { from: mb.start, to: mb.end };
  const title = view === "day" ? frDayTitle(date) : view === "week" ? `Semaine du ${frShort(ws)}` : monthTitle(date);

  const results = useMemo(() => {
    const q = NORM(search.trim());
    if (q.length < 2) return [];
    const seen = new Map();
    for (const s of P.sessions) {
      const name = sessionName(s, P.associations);
      if (!NORM(name).includes(q)) continue;
      if (!seen.has(s.id)) seen.set(s.id, s);
      if (seen.size >= 400) break;
    }
    return [...seen.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [search, P.sessions, P.associations]);
  const upcoming = results.filter((s) => s.date >= todayKey());
  const shown = (upcoming.length ? upcoming : results).slice(0, 8);

  const horizon = useMemo(() => { const t = todayKey(); const l = P.allSessions(t, addDays(t, 14)); const byDay = {}; l.forEach((s) => (byDay[s.date] ||= []).push(s)); const out = []; Object.entries(byDay).forEach(([d, arr]) => { const p = conflictPairs(arr, "same"); if (p.length) out.push([d, p]); }); return out; }, [P.allSessions]);
  const pending = P.sessions.filter((s) => s.status === "a_confirmer").length;

  const exportable = () => P.allSessions(range.from, range.to).filter((s) => matchesFilters(s, filters));
  const open = (d, roomId) => setDayModal({ date: d, roomId });

  return (
    <div>
      {(pending > 0 || horizon.length > 0) && (
        <div style={{ marginBottom: 10 }}>
          {pending > 0 && <div className="banner banner-amber"><b>{pending}</b> séance(s) en attente de validation cette année scolaire.<button className="link" onClick={() => setF("status", "a_confirmer")}>Voir</button></div>}
          {horizon.length > 0 && <div className="banner banner-red"><b>Conflits dans les 14 prochains jours :</b> {horizon.slice(0, 3).map(([d, p]) => `${frShort(d)} — ${conflictText(p.slice(0, 1), P.associations)}`).join(" · ")}</div>}
        </div>
      )}
      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10, position: "relative" }}>
        <div style={{ position: "relative", minWidth: 200, flex: "1 1 200px", maxWidth: 280 }}>
          <input className="planner-field" placeholder="Rechercher une association…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search.trim().length >= 2 && (
            <div className="card" style={{ position: "absolute", top: 40, left: 0, right: 0, zIndex: 20, padding: 4, maxHeight: 300, overflow: "auto" }}>
              {shown.length === 0 && <p className="help" style={{ padding: 8 }}>Aucun résultat</p>}
              {shown.map((s) => <button key={s.id} className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", height: "auto", padding: "6px 8px", textAlign: "left", whiteSpace: "normal" }} onClick={() => { P.setDate(s.date); setView("day"); setSearch(""); setDayModal({ date: s.date }); }}><span><b>{sessionName(s, P.associations)}</b><br /><span className="help">{frShort(s.date)} · {s.start}–{s.end}</span></span></button>)}
            </div>
          )}
        </div>
        <div className="seg">{[["room", "Par salle"], ["month", "Mois"], ["week", "Semaine"], ["day", "Jour"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
        <button className="btn btn-icon" onClick={() => step(-1)} aria-label="Précédent">‹</button>
        <button className="btn" onClick={() => P.setDate(todayKey())}>Aujourd'hui</button>
        <button className="btn btn-icon" onClick={() => step(1)} aria-label="Suivant">›</button>
        <div style={{ width: 150 }}><DateInput value={date} onChange={(v) => P.setDate(v)} /></div>
        <button className="btn" onClick={() => setShowAvail(true)}>Disponibilités</button>
        <button className="btn" onClick={() => setSheet(true)}>Fiche du jour</button>
        <button className="btn btn-primary" onClick={() => setForm({ initial: { date } })}>+ Réserver</button>
      </div>
      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <select className="planner-field" style={{ width: 170 }} value={filters.assoc} onChange={(e) => setF("assoc", e.target.value)}><option value="all">Toutes les associations</option>{P.associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className="planner-field" style={{ width: 150 }} value={filters.room} onChange={(e) => setF("room", e.target.value)}><option value="all">Toutes les salles</option>{P.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select className="planner-field" style={{ width: 170 }} value={filters.status} onChange={(e) => setF("status", e.target.value)}><option value="all">Tous les statuts</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="planner-field" style={{ width: 150 }} value={filters.payment} onChange={(e) => setF("payment", e.target.value)}><option value="all">Tous les paiements</option>{Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="planner-field" style={{ width: 140 }} value={filters.moment} onChange={(e) => setF("moment", e.target.value)}><option value="all">Toute la journée</option><option value="morning">Matin</option><option value="afternoon">Après-midi</option><option value="evening">Soir</option></select>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => download(`planning-${range.from}.ics`, "text/calendar", planningIcs(exportable(), P.associations, P.rooms))}>iCal</button>
        <button className="btn" onClick={() => download(`planning-${range.from}.csv`, "text/csv", planningCsv(exportable(), P.associations, P.rooms))}>Excel (CSV)</button>
        <button className="btn" onClick={() => window.print()}>Imprimer</button>
      </div>
      <h2 className="serif" style={{ fontSize: 22, marginBottom: 10, textTransform: "capitalize" }}>{title}</h2>
      {view === "room" && <RoomGridView range={range} filters={filters} onCell={open} />}
      {view === "month" && <MonthView date={date} filters={filters} onDay={(d) => open(d)} />}
      {view === "week" && <WeekView date={date} filters={filters} onDay={(d) => open(d)} />}
      {view === "day" && <DayAgendaView date={date} filters={filters} onDay={(d) => open(d)} />}
      {dayModal && <DayModal date={dayModal.date} roomId={dayModal.roomId} onClose={() => setDayModal(null)} />}
      {form && <BookingForm initial={form.initial} onClose={() => setForm(null)} />}
      {showAvail && <AvailabilityModal date={date} onClose={() => setShowAvail(false)} />}
      {sheet && <DailySheet date={date} onClose={() => setSheet(false)} />}
    </div>
  );
}
