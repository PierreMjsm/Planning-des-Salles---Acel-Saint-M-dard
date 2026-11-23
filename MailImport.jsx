import React, { useMemo, useState } from "react";
import { Modal, Field } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { parseMail, toBookingInitial } from "../lib/planner/mailparse.js";
import { frShort } from "../lib/planner/dates.js";

// Coller le texte d'un mail : le logiciel y cherche la date, l'horaire, la salle
// et le demandeur, puis ouvre une réservation pré-remplie à relire.
export default function MailImport({ onClose, onCreate }) {
  const P = usePlanner();
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseMail(text, { rooms: P.rooms, associations: P.allAssociations }), [text, P.rooms, P.allAssociations]);
  const ok = parsed.dates.length > 0;
  const Ligne = ({ label, value, miss }) => (
    <div className={"check check-" + (value ? "ok" : miss ? "warn" : "info")}>
      <span aria-hidden="true">{value ? "✓" : "⚠"}</span>
      <span><b>{label}</b> : {value || <span className="help">non trouvé, à saisir à la main</span>}</span>
    </div>
  );
  return (
    <Modal title="Réserver depuis un mail" subtitle="Collez le texte du message : rien n'est enregistré sans votre relecture." onClose={onClose} width={700}>
      <Field label="Texte du mail">
        <textarea className="planner-field" rows={9} value={text} autoFocus placeholder={"Bonjour,\nSerait-il possible de réserver la salle Carré Censier le samedi 14 mars de 14h à 18h pour un anniversaire d'une vingtaine de personnes ?\nMerci, Marie Dupont — 06 12 34 56 78"} onChange={(e) => setText(e.target.value)} />
      </Field>
      {text.trim() !== "" && (
        <div className="checklist" style={{ marginBottom: 10 }}>
          <Ligne label="Date" value={parsed.dates.map((d) => frShort(d)).join(", ")} miss />
          <Ligne label="Horaires" value={parsed.start ? `${parsed.start}${parsed.end ? ` – ${parsed.end}` : " (fin à préciser)"}` : ""} miss />
          <Ligne label="Salle" value={parsed.roomName} miss />
          <Ligne label="Association" value={parsed.associationName || ""} />
          <Ligne label="Contact" value={parsed.contact} />
          {parsed.participants && <Ligne label="Participants" value={parsed.participants} />}
        </div>
      )}
      <p className="help" style={{ marginBottom: 10 }}>Le mail est recopié dans la note interne de la réservation : il reste consultable plus tard, et n'apparaît sur aucun relevé. La réservation est créée « en attente de validation ».</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!ok} onClick={() => { onCreate(toBookingInitial(parsed, text)); onClose(); }}>
          {parsed.dates.length > 1 ? `Préparer ${parsed.dates.length} réservations` : "Préparer la réservation"}
        </button>
      </div>
      {!ok && text.trim() !== "" && <p className="help" style={{ textAlign: "right", marginTop: 6 }}>Aucune date trouvée : ajoutez-la dans le texte, ou passez par « + Réserver ».</p>}
    </Modal>
  );
}
