import React, { useMemo } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { MONTH_ABBR, PALETTE } from "../lib/planner/constants.js";
import { yearBounds, todayKey, eachDay, isWeekend, monthBounds } from "../lib/planner/dates.js";
import { durationHours, round2, sessionName } from "../lib/planner/occurrences.js";
import { fmtMoney, fmtHours } from "../lib/planner/format.js";
import { NoteLines } from "../components/Views.jsx";
import { frDayTitle } from "../lib/planner/dates.js";
import { vacationFor, conflictPairs } from "../lib/planner/occurrences.js";

export default function Dashboard() {
  const P = usePlanner();
  const b = yearBounds(P.year);
  const t = todayKey();
  const data = useMemo(() => {
    const valid = P.sessions.filter((s) => s.status === "confirme");
    const months = [];
    for (let i = 0; i < 12; i++) { const m = (8 + i) % 12; const y = P.year + (8 + i >= 12 ? 1 : 0); months.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: MONTH_ABBR[m], hours: 0, y, m }); }
    const byAssoc = new Map(), byRoom = new Map();
    for (const s of valid) {
      const h = durationHours(s.start, s.end);
      const mo = months.find((x) => s.date.startsWith(x.key)); if (mo) mo.hours += h;
      byAssoc.set(s.associationId || s.customName || "—", (byAssoc.get(s.associationId || s.customName || "—") || 0) + h);
      byRoom.set(s.roomId, (byRoom.get(s.roomId) || 0) + h);
    }
    months.forEach((mo) => { const mb = monthBounds(`${mo.key}-01`); const days = eachDay(mb.start, mb.end).filter((d) => !isWeekend(d)).length; mo.occ = P.rooms.length ? Math.round((mo.hours / (P.rooms.length * days * 12)) * 100) : 0; mo.hours = round2(mo.hours); });
    return { months, byAssoc: [...byAssoc].sort((a, c) => c[1] - a[1]).slice(0, 8), byRoom: [...byRoom].sort((a, c) => c[1] - a[1]), totalH: round2(valid.reduce((s, x) => s + durationHours(x.start, x.end), 0)) };
  }, [P.sessions, P.rooms, P.year]);
  const pending = P.sessions.filter((s) => s.status === "a_confirmer").length;
  const unpaid = P.sessions.filter((s) => s.status === "confirme" && s.paymentStatus === "unpaid").length;
  const owed = P.invoices.reduce((s, i) => s + Math.max(0, i.total - i.amountPaid), 0);
  const todayCount = P.allSessions(t, t).filter((s) => s.status !== "annule").length;
  const todayList = P.allSessions(t, t).filter((s) => s.status !== "annule").sort((a, c) => (a.start < c.start ? -1 : 1));
  const todayClash = conflictPairs(todayList.filter((s) => s.status !== "annule"), "same").length;
  const vacToday = vacationFor(P.vacations, t);
  const max = Math.max(1, ...data.months.map((m) => m.hours));
  const nameOf = (id) => P.associations.find((a) => a.id === id)?.name || id;
  const roomName = (id) => P.rooms.find((r) => r.id === id)?.name || "Salle supprimée";
  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="serif" style={{ marginBottom: 6 }}>Aujourd'hui · {frDayTitle(t)}</h2>
        {vacToday && <div className="help" style={{ marginBottom: 4 }}>Vacances scolaires : {vacToday.label}</div>}
        {todayClash > 0 && <div className="banner banner-red">{todayClash} conflit(s) de salle aujourd'hui</div>}
        <NoteLines note={P.dayNoteFor(t)} />
        {todayList.length === 0 ? <p className="help">Aucune réservation aujourd'hui.</p> : todayList.map((s) => <div key={s.id} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "1px solid #F0E9D9", flexWrap: "wrap" }}><b style={{ minWidth: 100 }}>{s.start}–{s.end}</b><span style={{ minWidth: 140 }}>{roomName(s.roomId)}</span><span style={{ flex: 1 }}>{sessionName(s, P.associations)}</span>{s.status === "a_confirmer" && <span className="tag tag-amber">En attente</span>}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
        <div className="stat"><div className="eyebrow">Aujourd'hui</div><div className="big">{todayCount}</div><div className="help">séance(s)</div></div>
        <div className="stat"><div className="eyebrow">À valider</div><div className="big" style={{ color: "#BA7517" }}>{pending}</div><div className="help">en attente</div></div>
        <div className="stat"><div className="eyebrow">Non payées</div><div className="big" style={{ color: "#A32D2D" }}>{unpaid}</div><div className="help">séances validées</div></div>
        <div className="stat"><div className="eyebrow">Reste dû (relevés)</div><div className="big">{fmtMoney(owed)}</div></div>
        <div className="stat"><div className="eyebrow">Heures validées</div><div className="big">{fmtHours(data.totalH)}</div><div className="help">{b.start.slice(0, 4)}-{b.end.slice(0, 4)}</div></div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 className="serif">Heures validées par mois</h3>
        <div className="bars">{data.months.map((m, i) => <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "stretch", height: "100%" }} title={`${m.hours} h · occupation ${m.occ} %`}><div className="help" style={{ textAlign: "center", fontSize: 10 }}>{m.hours || ""}</div><div className="bar" style={{ height: `${(m.hours / max) * 100}%`, background: PALETTE[i % 8].border }} /></div>)}</div>
        <div style={{ display: "flex", gap: 6 }}>{data.months.map((m) => <div key={m.key} style={{ flex: 1, textAlign: "center", fontSize: 11 }}><div>{m.label}</div><div className="help">{m.occ} %</div></div>)}</div>
        <p className="help" style={{ marginTop: 6 }}>Taux d'occupation = heures validées du mois ÷ (salles × jours ouvrés × 12 h).</p>
      </div>
      <div className="two-col">
        <div className="card"><h3 className="serif" style={{ marginBottom: 8 }}>Associations les plus actives</h3>{data.byAssoc.map(([k, h]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F0E9D9" }}><span>{nameOf(k)}</span><b>{fmtHours(round2(h))}</b></div>)}{data.byAssoc.length === 0 && <p className="help">Aucune donnée.</p>}</div>
        <div className="card"><h3 className="serif" style={{ marginBottom: 8 }}>Heures par salle</h3>{data.byRoom.map(([k, h]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F0E9D9" }}><span>{roomName(k)}</span><b>{fmtHours(round2(h))}</b></div>)}{data.byRoom.length === 0 && <p className="help">Aucune donnée.</p>}</div>
      </div>
    </div>
  );
}
