import React, { useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { Field, DateInput } from "../components/ui.jsx";
import { PrintLayer } from "../components/DailySheet.jsx";
import ConventionDoc from "../components/ConventionDoc.jsx";
import { conventionSettings, conventionTracking, trackingSummary, tariffTable, roomsOutside, roomsWithoutRate, seasonLabel } from "../lib/planner/convention.js";
import { todayKey, frShort, yearLabel } from "../lib/planner/dates.js";
import { fmtDec } from "../lib/planner/format.js";

// La demande de mise à disposition : le document à distribuer, avec les tarifs
// à jour, et le pointage des fiches rendues.
export default function Conventions() {
  const P = usePlanner();
  const today = todayKey();
  const cfg = useMemo(() => conventionSettings(P.org, P.year, today), [P.org, P.year]);
  const [print, setPrint] = useState(false);
  const set = (k, v) => P.updateOrg({ convention: { ...(P.org.convention || {}), [k]: v } });
  const table = useMemo(() => tariffTable(P.rooms), [P.rooms]);
  const outside = useMemo(() => roomsOutside(P.rooms), [P.rooms]);
  const noRate = useMemo(() => roomsWithoutRate(P.rooms), [P.rooms]);
  const rows = useMemo(() => conventionTracking(P.associations, cfg.returnDeadline, today), [P.associations, cfg.returnDeadline, today]);
  const sum = useMemo(() => trackingSummary(rows), [rows]);
  const mark = (a, field, on) => P.updateAssociation(a.id, { [field]: on ? today : "" });
  const markAllSent = () => P.ask(`Noter la fiche envoyée à ${rows.filter((r) => !r.sentAt).length} association(s) ?`,
    () => P.undoable("Fiches de convention notées envoyées", ["Association"], () => rows.filter((r) => !r.sentAt).forEach((r) => P.updateAssociation(r.id, { conventionSentAt: today }))));

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 className="serif" style={{ marginBottom: 4 }}>Demande de mise à disposition · saison {seasonLabel(P.year)}</h2>
        <p className="help" style={{ marginBottom: 10 }}>Le courrier et la fiche remis à chaque association. Le tableau des tarifs se construit à partir du prix par salle (Réglages › Salles) : il est toujours à jour.</p>
        <div className="row">
          <Field label="Date du courrier"><DateInput value={cfg.letterDate} onChange={(v) => set("letterDate", v)} /></Field>
          <Field label="Ouverture aux activités"><DateInput value={cfg.openingDate} onChange={(v) => set("openingDate", v)} /></Field>
          <Field label="Retour de la fiche"><DateInput value={cfg.returnDeadline} onChange={(v) => set("returnDeadline", v)} /></Field>
          <Field label="Liste des mineurs"><DateInput value={cfg.minorsDeadline} onChange={(v) => set("minorsDeadline", v)} /></Field>
        </div>
        <Field label="Signataires"><input className="planner-field" defaultValue={cfg.signatories} onBlur={(e) => e.target.value !== cfg.signatories && set("signatories", e.target.value)} /></Field>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary" onClick={() => setPrint(true)}>Voir et imprimer le document</button>
          <span className="help">{table.reduce((n, g) => n + g.lines.length, 0)} salle(s) au tableau des tarifs</span>
        </div>
        {noRate.length > 0 && <div className="banner banner-amber" style={{ marginTop: 10 }}>{noRate.length} salle(s) sans tarif apparaîtraient à 0 euros : {noRate.map((r) => r.name).join(", ")} (Réglages › Salles).</div>}
        {outside.length > 0 && <p className="help" style={{ marginTop: 8 }}>Hors tableau : {outside.map((r) => r.name).join(", ")}.</p>}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 className="serif" style={{ marginBottom: 6 }}>Tarifs de la saison</h3>
        <table className="table" style={{ maxWidth: 620 }}>
          <thead><tr><th>Salles</th><th>Zones</th><th style={{ textAlign: "right" }}>Tarifs</th></tr></thead>
          <tbody>
            {table.map((g) => (
              <React.Fragment key={g.section}>
                <tr className="group-row"><td colSpan={3}><b>{g.section}</b></td></tr>
                {g.lines.map((l) => <tr key={l.roomId}><td style={{ paddingLeft: 20 }}>{l.label}</td><td className="help">{l.zone}</td><td style={{ textAlign: "right" }}>{fmtDec(l.rate)} euros</td></tr>)}
              </React.Fragment>
            ))}
            {table.length === 0 && <tr><td colSpan={3}><p className="help" style={{ margin: 6 }}>Aucune salle rangée dans une section du tableau.</p></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="serif" style={{ marginBottom: 6 }}>Fiches rendues · {yearLabel(P.year)}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <span className={"tag " + (sum.missing ? "tag-amber" : "tag-green")}>{sum.received} / {sum.total} rendue(s)</span>
          {sum.late > 0 && <span className="tag tag-red">{sum.late} en retard sur le {frShort(cfg.returnDeadline)}</span>}
          <span className="help">{sum.sent} fiche(s) notée(s) envoyée(s)</span>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={markAllSent}>Tout noter envoyé</button>
        </div>
        <table className="table">
          <thead><tr><th>Association</th><th style={{ textAlign: "center", width: 120 }}>Envoyée</th><th style={{ textAlign: "center", width: 120 }}>Rendue</th><th style={{ width: 120 }}></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.receivedAt ? "pc-done" : ""}>
                <td><b>{r.name}</b></td>
                <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Fiche envoyée : ${r.name}`} checked={!!r.sentAt} onChange={(e) => mark(r, "conventionSentAt", e.target.checked)} />{r.sentAt && <div className="help">{frShort(r.sentAt)}</div>}</td>
                <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Fiche rendue : ${r.name}`} checked={!!r.receivedAt} onChange={(e) => mark(r, "conventionReceivedAt", e.target.checked)} />{r.receivedAt && <div className="help">{frShort(r.receivedAt)}</div>}</td>
                <td>{r.late && <span className="tag tag-red">à relancer</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4}><p className="help" style={{ margin: 6 }}>Aucune association cette année.</p></td></tr>}
          </tbody>
        </table>
      </div>

      {print && (
        <PrintLayer title={`Demande de mise à disposition ${seasonLabel(P.year)}`} pdfName={`Demande-mise-a-disposition-${yearLabel(P.year)}`} onClose={() => setPrint(false)}>
          <ConventionDoc cfg={cfg} year={P.year} />
        </PrintLayer>
      )}
    </div>
  );
}
