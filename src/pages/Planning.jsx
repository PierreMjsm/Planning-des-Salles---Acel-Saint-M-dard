import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { RoomGridView, MonthView, DayAgendaView } from "../components/Views.jsx";
import DayModal from "../components/DayModal.jsx";
import BookingForm from "../components/BookingForm.jsx";
import StageModal from "../components/StageModal.jsx";
import DayNoteModal from "../components/DayNoteModal.jsx";
import AvailabilityModal from "../components/AvailabilityModal.jsx";
import DailySheet from "../components/DailySheet.jsx";
import { STATUS_LABELS, PAYMENT_LABELS } from "../lib/planner/constants.js";
import { addDays, addMonths, monthBounds, weekStart, monthTitle, frDayTitle, todayKey, frShort, schoolYearOf, yearBounds } from "../lib/planner/dates.js";
import PrintPlanning from "../components/PrintPlanning.jsx";
import { sessionName, matchesFilters, conflictPairs, conflictText, activeSessions, timesOverlap, vacationFor } from "../lib/planner/occurrences.js";
import { DateInput } from "../components/ui.jsx";
import { download, planningCsv, planningIcs } from "../lib/planner/exports.js";

const NORM = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Planning() {
  const P = usePlanner();
  const lsGet = (k, d) => { try { const v = window.localStorage.getItem("salleplan.ui." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { window.localStorage.setItem("salleplan.ui." + k, JSON.stringify(v)); } catch (e) { /* ignoré */ } };
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.innerWidth < 700 ? "day" : (lsGet("view", "room") === "week" ? "room" : lsGet("view", "room"))));
  const [printPlan, setPrintPlan] = useState(false);
  const searchRef = useRef(null);
  const [filters, setFilters] = useState(() => ({ assoc: "all", room: "all", status: "all", payment: "all", moment: "all", ...lsGet("filters", {}) }));
  useEffect(() => { lsSet("view", view); lsSet("filters", filters); }, [view, filters]);
  const [search, setSearch] = useState("");
  const [dayModal, setDayModal] = useState(null);
  const [form, setForm] = useState(null);
  const [showAvail, setShowAvail] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [stage, setStage] = useState(false);
  const [noteDay, setNoteDay] = useState(null);
  const date = P.date;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [vis, setVis] = useState(P.date);
  const [focus, setFocus] = useState({ date: P.date, n: 0 });
  const navLock = useRef(0);
  const onVisible = (d) => { if (Date.now() > navLock.current) setVis(d); };
  const goTo = (d) => { navLock.current = Date.now() + 900; P.setDate(d); setVis(d); setFocus((f) => ({ date: d, n: f.n + 1 })); };
  useEffect(() => { setVis(P.date); setFocus((f) => ({ date: P.date, n: f.n + 1 })); }, [P.date]);
  useEffect(() => { if (!menu) return; const c = () => setMenu(null); document.addEventListener("click", c); return () => document.removeEventListener("click", c); }, [menu]);
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!P.openReq) return;
    setDayModal({ date: P.openReq.date, roomId: P.openReq.roomId });
    P.clearOpenReq();
  }, [P.openReq]);

  const drop = (drag, toDate, toRoomId) => {
    const s = P.allSessions(drag.date, drag.date).find((x) => x.id === drag.id);
    if (!s) return;
    const doIt = () => P.undoable("Séance déplacée", ["Booking", "RecurringBooking"], () => P.moveSession(s, toDate, toRoomId));
    const clash = activeSessions(P.allSessions(toDate, toDate)).some((x) => x.roomId === (toRoomId || s.roomId) && x.id !== s.id && timesOverlap(x.start, x.end, s.start, s.end));
    if (clash) P.ask("Cette salle est déjà occupée sur ce créneau. Déplacer quand même ?", doIt); else doIt();
  };

  const step = (dir) => {
    if (view === "room") {
      goTo(addDays(vis, 7 * dir));
    } else if (view === "month") goTo(addMonths(date, dir));
    else goTo(addDays(date, dir));
  };
  const stepRef = useRef(step); stepRef.current = step;
  useEffect(() => {
    const h = (e) => {
      const k = e.detail;
      if (k === "n" || k === "N") setForm({ initial: { date: P.date } });
      else if (k === "t" || k === "T") goTo(todayKey());
      else if (k === "ArrowLeft") stepRef.current(-1);
      else if (k === "ArrowRight") stepRef.current(1);
      else if (k === "1") setView("room"); else if (k === "2") setView("month"); else if (k === "3") setView("day");
      else if (k === "/") setTimeout(() => searchRef.current && searchRef.current.focus(), 0);
    };
    window.addEventListener("salleplan:key", h);
    return () => window.removeEventListener("salleplan:key", h);
  }, [P.date, vis, view]);
  const yb = yearBounds(P.year); const gridRange = { from: yb.start, to: yb.end };
  const mb = monthBounds(view === "room" ? vis : date);
  const range = view === "day" ? { from: date, to: date } : { from: mb.start, to: mb.end };
  const title = view === "day" ? frDayTitle(date) : monthTitle(view === "room" ? vis : date);
  const activeFilters = [
    ["assoc", filters.assoc !== "all" && (P.associations.find((a) => a.id === filters.assoc) || {}).name],
    ["room", filters.room !== "all" && (P.rooms.find((r) => r.id === filters.room) || {}).name],
    ["status", filters.status !== "all" && STATUS_LABELS[filters.status]],
    ["payment", filters.payment !== "all" && PAYMENT_LABELS[filters.payment]],
    ["moment", filters.moment !== "all" && { morning: "Matin", afternoon: "Après-midi", evening: "Soir" }[filters.moment]],
  ].filter(([, v]) => v);
  const resetFilters = () => setFilters({ assoc: "all", room: "all", status: "all", payment: "all", moment: "all" });
  const vacNow = vacationFor(P.vacations, view === "room" ? vis : date);

  const results = useMemo(() => {
    const q = NORM(search.trim());
    if (q.length < 2) return [];
    const seen = new Map();
    for (const s of P.sessions) {
      const name = sessionName(s, P.associations);
      const room = (P.rooms.find((r) => r.id === s.roomId) || {}).name || "";
      const hay = NORM([name, room, s.note, s.internalNote, s.contact, s.date, frShort(s.date)].filter(Boolean).join(" "));
      if (!hay.includes(q)) continue;
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

  const MenuBtn = ({ id, label, primary, children }) => (
    <div className="menu" onClick={(e) => e.stopPropagation()}>
      <button className={"btn" + (primary ? " btn-primary" : "")} aria-haspopup="true" aria-expanded={menu === id} onClick={() => setMenu(menu === id ? null : id)}>{label} ▾</button>
      {menu === id && <div className="pop" onClick={() => setMenu(null)}>{children}</div>}
    </div>
  );
  return (
    <div>
      <div className="no-print toolbar" role="toolbar" aria-label="Outils du planning">
        <div className="tb-group">
          <button className="btn btn-icon" onClick={() => step(-1)} aria-label="Précédent">‹</button>
          <span className="tb-title serif">{title}</span>
          <button className="btn btn-icon" onClick={() => step(1)} aria-label="Suivant">›</button>
          <button className="btn" onClick={() => goTo(todayKey())}>Aujourd'hui</button>
        </div>
        <div className="seg" role="group" aria-label="Affichage">{[["room", "Salles"], ["month", "Mois"], ["day", "Jour"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
        <span style={{ flex: 1 }} />
        <div style={{ position: "relative", minWidth: 190, flex: "0 1 230px" }}>
          <input ref={searchRef} className="planner-field" placeholder="Rechercher…  ( / )" aria-label="Rechercher" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search.trim().length >= 2 && (
            <div className="card" style={{ position: "absolute", top: 40, left: 0, right: 0, zIndex: 20, padding: 4, maxHeight: 300, overflow: "auto", minWidth: 260 }}>
              {shown.length === 0 && <p className="help" style={{ padding: 8 }}>Aucun résultat</p>}
              {shown.map((s) => <button key={s.id} className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", height: "auto", padding: "6px 8px", textAlign: "left", whiteSpace: "normal" }} onClick={() => { goTo(s.date); setSearch(""); setDayModal({ date: s.date }); }}><span><b>{sessionName(s, P.associations)}</b><br /><span className="help">{frShort(s.date)} · {s.start}–{s.end}</span></span></button>)}
            </div>
          )}
        </div>
        <button className={"btn" + (filtersOpen ? " on" : "")} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filtres{activeFilters.length > 0 && <span className="count">{activeFilters.length}</span>}</button>
        <MenuBtn id="actions" label="Actions">
          <h4>Imprimer</h4>
          <button onClick={() => setSheet(true)}>Fiche du jour</button>
          <button onClick={() => setPrintPlan(true)}>Planning officiel</button>
          <h4>Exporter</h4>
          <button onClick={() => download(`planning-${range.from}.csv`, "text/csv", planningCsv(exportable(), P.associations, P.rooms))}>Excel (CSV)</button>
          <button onClick={() => download(`planning-${range.from}.ics`, "text/calendar", planningIcs(exportable(), P.associations, P.rooms))}>Agenda (iCal)</button>
          <h4>Outils</h4>
          <button onClick={() => setShowAvail(true)}>Chercher une salle libre</button>
          <div className="pop-field" onClick={(e) => e.stopPropagation()}><label>Aller à une date</label><DateInput value={date} onChange={(v) => { goTo(v); setMenu(null); }} /></div>
        </MenuBtn>
        <MenuBtn id="new" label="+ Réserver" primary>
          <button onClick={() => setForm({ initial: { date } })}>Réservation ou série <kbd>N</kbd></button>
          <button onClick={() => setStage(true)}>Stage BAFA</button>
        </MenuBtn>
      </div>
      {(pending > 0 || horizon.length > 0 || activeFilters.length > 0 || vacNow) && (
        <div className="no-print strip">
          {pending > 0 && <button className="pill pill-warn" onClick={() => setF("status", "a_confirmer")}>{pending} à valider</button>}
          {horizon.length > 0 && <button className="pill pill-bad" title={horizon.slice(0, 3).map(([d, p]) => `${frShort(d)} — ${conflictText(p.slice(0, 1), P.associations)}`).join("\n")} onClick={() => goTo(horizon[0][0])}>{horizon.length} jour(s) en conflit sous 14 jours</button>}
          {activeFilters.map(([k, v]) => <span key={k} className="pill pill-soft">{v}<button aria-label={"Retirer le filtre " + v} onClick={() => setF(k, "all")}>×</button></span>)}
          <span style={{ flex: 1 }} />
          {vacNow && <span className="help">Vacances scolaires : {vacNow.label}</span>}
        </div>
      )}
      <div className="plan-body">
        {filtersOpen && (
          <aside className="no-print side" aria-label="Filtres">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3>Filtres</h3><button className="link" onClick={() => setFiltersOpen(false)}>Fermer</button></div>
            <label htmlFor="f-assoc">Association</label><select id="f-assoc" className="planner-field" value={filters.assoc} onChange={(e) => setF("assoc", e.target.value)}><option value="all">Toutes</option>{P.associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <label htmlFor="f-room">Salle</label><select id="f-room" className="planner-field" value={filters.room} onChange={(e) => setF("room", e.target.value)}><option value="all">Toutes</option>{P.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <label htmlFor="f-status">Statut</label><select id="f-status" className="planner-field" value={filters.status} onChange={(e) => setF("status", e.target.value)}><option value="all">Tous</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <label htmlFor="f-pay">Paiement</label><select id="f-pay" className="planner-field" value={filters.payment} onChange={(e) => setF("payment", e.target.value)}><option value="all">Tous</option>{Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <label htmlFor="f-moment">Moment</label><select id="f-moment" className="planner-field" value={filters.moment} onChange={(e) => setF("moment", e.target.value)}><option value="all">Toute la journée</option><option value="morning">Matin</option><option value="afternoon">Après-midi</option><option value="evening">Soir</option></select>
            <button className="btn" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={resetFilters} disabled={activeFilters.length === 0}>Réinitialiser</button>
            <h3 style={{ marginTop: 18 }}>Légende</h3>
            <div className="legend">
              <span><i style={{ background: "#DCEAF0", border: "1px solid #9DBFCC" }} />Association (une couleur chacune)</span>
              <span><i style={{ border: "2px solid #E24B4A" }} />En attente de validation</span>
              <span><i style={{ border: "3px dashed #555" }} />Stage BAFA</span>
              <span><i style={{ border: "4px double #555" }} />Copropriété</span>
              <span><i style={{ background: "#FBE4EC" }} />Vacances scolaires</span>
              <span><i className="hatch" style={{ border: "1px solid #ccc" }} />Salle fermée</span>
              <span><i style={{ background: "#F4F1E9", border: "1px solid #ddd" }} />Week-end</span>
              <span><i className="shut" style={{ border: "1px solid #ccc" }} />Maison fermée</span>
              <span><b style={{ color: "#C0392B" }}>●</b> Relevé en retard de paiement</span>
            </div>
          </aside>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
      {view === "room" && <RoomGridView range={gridRange} focus={focus} filters={filters} onCell={open} onNote={setNoteDay} onDrop={drop} onVisible={onVisible} />}
      {view === "month" && <MonthView date={date} filters={filters} onDay={(d) => open(d)} onNote={setNoteDay} onDrop={drop} />}
      {view === "day" && <DayAgendaView date={date} filters={filters} onDay={(d) => open(d)} onNote={setNoteDay} />}
        </div>
      </div>
      {dayModal && <DayModal date={dayModal.date} roomId={dayModal.roomId} onClose={() => setDayModal(null)} />}
      {form && <BookingForm initial={form.initial} onClose={() => setForm(null)} />}
      {printPlan && <PrintPlanning range={range} onClose={() => setPrintPlan(false)} />}
      {stage && <StageModal initialDate={date} onClose={() => setStage(false)} />}
      {noteDay && <DayNoteModal date={noteDay} onClose={() => setNoteDay(null)} />}
      {showAvail && <AvailabilityModal date={date} onClose={() => setShowAvail(false)} />}
      {sheet && <DailySheet date={date} onClose={() => setSheet(false)} />}
    </div>
  );
}
