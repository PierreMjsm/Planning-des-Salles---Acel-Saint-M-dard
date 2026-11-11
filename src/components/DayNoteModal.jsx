import React, { useState } from "react";
import { Modal, Field } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { frLong, capitalize } from "../lib/planner/dates.js";

export default function DayNoteModal({ date, onClose }) {
  const P = usePlanner();
  const cur = P.dayNoteFor(date) || {};
  const [f, setF] = useState({ opening: cur.opening || "", closing: cur.closing || "", absence: cur.absence || "", note: cur.note || "", closed: !!cur.closed });
  const team = P.org.staff || [];
  const split = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  const toggle = (k, name) => setF((x) => { const l = split(x[k]); return { ...x, [k]: (l.includes(name) ? l.filter((n) => n !== name) : [...l, name]).join(", ") }; });
  const Pick = ({ k, label }) => (
    <Field label={label}>
      {team.length > 0 && <div className="name-chips">{team.map((n) => <button type="button" key={n} className={"name-chip" + (split(f[k]).includes(n) ? " on" : "")} aria-pressed={split(f[k]).includes(n)} onClick={() => toggle(k, n)}>{n}</button>)}</div>}
      <input className="planner-field" placeholder={team.length ? "Autre nom (facultatif)" : "Nom (la liste de l'équipe se règle dans Réglages › Équipe)"} value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => { P.saveDayNote(date, { opening: f.opening.trim(), closing: f.closing.trim(), absence: f.absence.trim(), note: f.note.trim(), closed: !!f.closed }); P.notify("Note du jour enregistrée"); onClose(); };
  return (
    <Modal title="Note du jour" subtitle={capitalize(frLong(date))} onClose={onClose} width={480}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, padding: "8px 10px", borderRadius: 8, marginBottom: 10, background: f.closed ? "#F3D9D6" : "var(--bg-soft, #f4f2ec)", color: f.closed ? "#8E2B20" : "inherit" }}>
        <input type="checkbox" checked={!!f.closed} onChange={(e) => set("closed", e.target.checked)} />🚫 Maison fermée ce jour <span className="help" style={{ fontWeight: 400 }}>(le jour apparaît en rouge dans le planning)</span>
      </label>
      <Pick k="opening" label="🔑 Personne à l'ouverture" />
      <Pick k="closing" label="🔒 Personne à la fermeture" />
      <Pick k="absence" label="⚠ Salarié absent" />
      <Field label="📝 Commentaire"><textarea className="planner-field" rows={3} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
      <p className="help">Ces informations s'affichent au-dessus du jour uniquement quand elles sont renseignées. Videz tous les champs pour supprimer la note.</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save}>Enregistrer</button></div>
    </Modal>
  );
}
