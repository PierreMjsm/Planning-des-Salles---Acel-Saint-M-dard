import React, { useState } from "react";
import { Modal, Field } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { frLong, capitalize } from "../lib/planner/dates.js";

export default function DayNoteModal({ date, onClose }) {
  const P = usePlanner();
  const cur = P.dayNoteFor(date) || {};
  const [f, setF] = useState({ opening: cur.opening || "", closing: cur.closing || "", absence: cur.absence || "", note: cur.note || "" });
  const names = [...new Set(P.db.DayNote.flatMap((n) => [n.opening, n.closing, n.absence]).filter(Boolean).concat(["Katell", "Pierre"]))];
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => { P.saveDayNote(date, { opening: f.opening.trim(), closing: f.closing.trim(), absence: f.absence.trim(), note: f.note.trim() }); P.notify("Note du jour enregistrée"); onClose(); };
  return (
    <Modal title="Note du jour" subtitle={capitalize(frLong(date))} onClose={onClose} width={480}>
      <datalist id="names-list">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <Field label="🔑 Personne à l'ouverture"><input className="planner-field" list="names-list" value={f.opening} onChange={(e) => set("opening", e.target.value)} /></Field>
      <Field label="🔒 Personne à la fermeture"><input className="planner-field" list="names-list" value={f.closing} onChange={(e) => set("closing", e.target.value)} /></Field>
      <Field label="⚠ Salarié absent"><input className="planner-field" list="names-list" value={f.absence} onChange={(e) => set("absence", e.target.value)} /></Field>
      <Field label="📝 Commentaire"><textarea className="planner-field" rows={3} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
      <p className="help">Ces informations s'affichent au-dessus du jour uniquement quand elles sont renseignées. Videz tous les champs pour supprimer la note.</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save}>Enregistrer</button></div>
    </Modal>
  );
}
