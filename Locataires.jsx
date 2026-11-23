import React, { useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { tenantRows, tenantSummary } from "../lib/planner/tenants.js";
import { yearLabel } from "../lib/planner/dates.js";

// La liste des associations locataires de l'année : une ligne par créneau
// hebdomadaire, plus les associations qui n'en ont aucun, pour voir d'un coup
// d'œil si tout le monde est bien placé.
export default function Locataires() {
  const P = usePlanner();
  const [only, setOnly] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => tenantRows({ associations: P.associations, recurring: P.recurring, rooms: P.rooms, sessions: P.yearSessions }), [P.associations, P.recurring, P.rooms, P.yearSessions]);
  const sum = useMemo(() => tenantSummary(rows), [rows]);
  const shown = rows.filter((r) => {
    if (only === "none" && !r.none) return false;
    if (only === "slots" && r.none) return false;
    if (only === "noaddress" && r.address) return false;
    const t = q.trim().toLowerCase();
    return !t || r.name.toLowerCase().includes(t) || r.rooms.toLowerCase().includes(t);
  });
  const Fil = ({ v, children }) => <button className={"btn" + (only === v ? " btn-primary" : "")} onClick={() => setOnly(v)}>{children}</button>;
  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 className="serif" style={{ marginBottom: 4 }}>Associations locataires · {yearLabel(P.year)}</h2>
        <p className="help" style={{ marginBottom: 10 }}>Reconstruite depuis les séries du planning : chaque ligne est un créneau hebdomadaire. Le nombre de semaines compte les séances réellement prévues sur l'année, vacances et fermetures déduites.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Fil v="all">Toutes ({sum.associations})</Fil>
          <Fil v="slots">Avec créneau ({sum.withSlot})</Fil>
          <Fil v="none">Sans créneau ({sum.without})</Fil>
          <Fil v="noaddress">Sans adresse ({sum.noAddress})</Fil>
          <input className="planner-field" style={{ flex: 1, minWidth: 160 }} placeholder="Chercher une association ou une salle" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {sum.without > 0 && only !== "none" && <div className="banner banner-amber" style={{ marginTop: 10 }}>{sum.without} association(s) de l'année n'ont aucun créneau dans le planning.</div>}
      </div>
      <div className="card">
        <table className="table tenants">
          <thead><tr><th>NOM de l'Asso</th><th>Adresse du Siège Social</th><th>Salle utilisée</th><th>Jour</th><th>Horaires</th><th>Dates</th></tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className={r.none ? "tenant-none" : ""}>
                <td><b>{r.name}</b></td>
                <td style={{ whiteSpace: "pre-line" }}>{r.address || <span className="help">—</span>}</td>
                <td>{r.none ? <span className="help">aucun créneau</span> : r.rooms}</td>
                <td style={{ textTransform: "uppercase" }}>{r.day}</td>
                <td>{r.hours}</td>
                <td>{r.none ? "" : `${r.weeks} semaine${r.weeks > 1 ? "s" : ""}`}{!r.none && r.status === "a_confirmer" ? <span className="tag tag-amber" style={{ marginLeft: 6 }}>à valider</span> : null}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6}><p className="help" style={{ margin: 6 }}>Aucune ligne pour ce filtre.</p></td></tr>}
          </tbody>
        </table>
        <p className="help" style={{ marginTop: 8 }}>{shown.filter((r) => !r.none).length} créneau(x) affiché(s). L'adresse du siège se renseigne dans Réglages › Associations.</p>
      </div>
    </div>
  );
}
