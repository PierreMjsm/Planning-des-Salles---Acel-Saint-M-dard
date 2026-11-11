import React, { useEffect, useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";

const ACTION = { create: ["Création", "tag-green"], update: ["Modification", "tag-amber"], delete: ["Suppression", "tag-red"] };
export default function Historique() {
  const P = usePlanner();
  const [q, setQ] = useState(""), [dq, setDq] = useState("");
  const [actor, setActor] = useState("all"), [action, setAction] = useState("all"), [type, setType] = useState("all");
  const [limit, setLimit] = useState(50);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim().toLowerCase()), 350); return () => clearTimeout(t); }, [q]);
  const all = useMemo(() => [...P.db.ActivityLog].reverse(), [P.db.ActivityLog]);
  const types = useMemo(() => [...new Set(all.map((e) => e.entityType))], [all]);
  const rows = all.filter((e) => (actor === "all" || e.actor === actor) && (action === "all" || e.action === action) && (type === "all" || e.entityType === type) && (!dq || `${e.targetLabel} ${e.detail}`.toLowerCase().includes(dq)));
  return (
    <div className="card">
      <h2 className="serif" style={{ marginBottom: 8 }}>Historique des modifications</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input className="planner-field" style={{ maxWidth: 240 }} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="planner-field" style={{ width: 140 }} value={actor} onChange={(e) => setActor(e.target.value)}><option value="all">Tous</option><option>Katell</option><option>Pierre</option></select>
        <select className="planner-field" style={{ width: 150 }} value={action} onChange={(e) => setAction(e.target.value)}><option value="all">Toutes les actions</option>{Object.entries(ACTION).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
        <select className="planner-field" style={{ width: 170 }} value={type} onChange={(e) => setType(e.target.value)}><option value="all">Tous les types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {rows.length === 0 ? <p className="help">Aucune modification enregistrée.</p> : (
        <table className="table"><thead><tr><th>Date</th><th>Qui</th><th>Action</th><th>Élément</th><th>Détail</th></tr></thead>
          <tbody>{rows.slice(0, limit).map((e) => <tr key={e.id}><td style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td><td>{e.actor}</td><td><span className={"tag " + (ACTION[e.action]?.[1] || "tag-grey")}>{ACTION[e.action]?.[0] || e.action}</span></td><td><b>{e.entityType}</b><br /><span className="help">{e.targetLabel}</span></td><td className="help">{e.detail}</td></tr>)}</tbody></table>
      )}
      {rows.length > limit && <div style={{ textAlign: "center", marginTop: 10 }}><button className="btn" onClick={() => setLimit(limit + 50)}>Charger plus</button></div>}
    </div>
  );
}
