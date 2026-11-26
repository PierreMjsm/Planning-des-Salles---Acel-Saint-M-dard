import React, { useMemo, useState } from "react";
import { Modal } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { yearLabel } from "../lib/planner/dates.js";

// Assistant de rentrée : on coche les séries à reconduire l'année suivante.
export default function RentreeModal({ onClose }) {
  const P = usePlanner();
  const target = P.year + 1;
  const rows = useMemo(() => P.rentreePreview(target), [P.db.RecurringBooking, P.db.Association, target]);
  const [sel, setSel] = useState(() => Object.fromEntries(rows.map((r) => [r.series.id, !r.conflict && !r.duplicate])));
  const [done, setDone] = useState(null);
  const n = Object.values(sel).filter(Boolean).length;
  const conflicts = rows.filter((r) => r.conflict).length;
  const dupes = rows.filter((r) => r.duplicate).length;
  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));
  const run = () => setDone(P.carryOverSeries(rows.filter((r) => sel[r.series.id]).map((r) => r.series.id), target));

  if (done) return (
    <Modal title={`Rentrée ${yearLabel(target)}`} onClose={onClose} width={560}>
      <p><b>{done.created} série(s) reconduite(s)</b> vers {yearLabel(target)}, en attente de validation : vous les retrouverez dans « À traiter ».</p>
      {done.associations.length > 0 && <p className="help">Associations recréées pour la nouvelle année : {done.associations.join(", ")}. Vérifiez leurs contacts et leur tarif dans Réglages › Associations.</p>}
      <p className="help">Choisissez l'année {yearLabel(target)} en haut à droite pour voir la nouvelle semaine type et les créneaux restants.</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn btn-primary" onClick={onClose}>Fermer</button></div>
    </Modal>
  );

  return (
    <Modal title={`Préparer la rentrée ${yearLabel(target)}`} subtitle={`D'après les séries de ${yearLabel(P.year)}`} onClose={onClose} width={720}>
      {rows.length === 0 ? <p className="help">Aucune série en {yearLabel(P.year)} à reconduire.</p> : (<>
        <p className="help">Décochez ce qui ne revient pas. Les séries reconduites gardent leur salle, leur jour et leurs horaires, décalés d'un an, et arrivent « en attente de validation ».</p>
        {(conflicts > 0 || dupes > 0) && <div className="banner banner-amber">{conflicts > 0 && <>⚠ {conflicts} série(s) tombent sur un créneau déjà pris en {yearLabel(target)} : décochées, à forcer si besoin. </>}{dupes > 0 && <>{dupes} série(s) sont déjà reconduites.</>}</div>}
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <button className="link" onClick={() => setSel(Object.fromEntries(rows.map((r) => [r.series.id, true])))}>Tout cocher</button>
          <button className="link" onClick={() => setSel({})}>Tout décocher</button>
        </div>
        <div style={{ maxHeight: 360, overflow: "auto" }}>
          <table className="table"><thead><tr><th style={{ width: 34 }}></th><th>Association</th><th>Salle</th><th>Jour</th><th>Horaires</th><th></th></tr></thead><tbody>
            {rows.map((r) => (
              <tr key={r.series.id} style={{ opacity: r.duplicate ? 0.55 : 1 }}>
                <td><input type="checkbox" aria-label={`Reconduire ${r.name}`} checked={!!sel[r.series.id]} disabled={r.duplicate} onChange={() => toggle(r.series.id)} /></td>
                <td><b>{r.name}</b></td><td>{r.roomName}</td><td>{r.dayLabel}</td><td>{r.timeLabel}</td>
                <td style={{ fontSize: 12 }}>{r.duplicate ? <span className="help">déjà reconduite</span> : r.conflict ? <span style={{ color: "#B3402F" }}>déjà pris : {r.conflict}</span> : ""}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </>)}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={n === 0} onClick={run}>Reconduire {n} série(s)</button>
      </div>
    </Modal>
  );
}
