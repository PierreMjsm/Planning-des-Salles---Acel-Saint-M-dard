import React, { useMemo, useState } from "react";
import { Modal } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { payerKindOf } from "../lib/planner/billing.js";
import { frShort } from "../lib/planner/dates.js";

// Requalifier les réservations à nom libre venues d'un import : elles sont toutes
// retombées sur « copropriété », donc un anniversaire se facture au prix fixe de la
// salle au lieu du tarif horaire. Une ligne par nom, pas par réservation.
const CHOIX = [
  { value: "", label: "— Ne pas changer —" },
  { value: "particulier", label: "Particulier (heures × tarif)" },
  { value: "copro", label: "Copropriété (prix fixe)" },
  { value: "interne", label: "Interne — ne pas facturer" },
];

export default function RequalifyModal({ onClose }) {
  const P = usePlanner();
  const [sel, setSel] = useState({});
  const [q, setQ] = useState("");

  // Tous les noms libres de l'année, réservations et séries confondues
  const noms = useMemo(() => {
    const m = new Map();
    const add = (x, serie) => {
      const nom = String(x.customName || "").trim();
      if (!nom || x.associationId || x.stageId) return;
      if (!m.has(nom)) m.set(nom, { nom, n: 0, dates: [], kinds: new Set(), exempt: 0, serie: false });
      const e = m.get(nom);
      e.n += 1;
      e.serie = e.serie || serie;
      e.kinds.add(payerKindOf(x) === "particulier" ? "particulier" : "copro");
      if (x.paymentStatus === "exempt") e.exempt += 1;
      if (x.startDate) e.dates.push(x.startDate);
      return e;
    };
    (P.bookings || []).forEach((x) => add(x, false));
    (P.recurring || []).forEach((x) => add(x, true));
    return [...m.values()].map((e) => ({ ...e, dates: e.dates.sort() }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [P.bookings, P.recurring]);

  const filtre = q.trim().toLowerCase();
  const vus = filtre ? noms.filter((e) => e.nom.toLowerCase().includes(filtre)) : noms;
  const poses = Object.entries(sel).filter(([, v]) => v);
  const touche = poses.reduce((t, [nom]) => t + (noms.find((e) => e.nom === nom)?.n || 0), 0);

  const tout = (kind) => { const s = { ...sel }; vus.forEach((e) => { s[e.nom] = kind; }); setSel(s); };
  const appliquer = () => {
    if (!poses.length) return;
    P.requalifyFreeNames(poses.map(([nom, kind]) => ({ name: nom, kind })));
    onClose();
  };

  const etat = (e) => {
    if (e.exempt === e.n) return <span className="tag">Non facturé</span>;
    if (e.kinds.size > 1) return <span className="tag tag-amber">Mélangé</span>;
    return <span className="help">{e.kinds.has("particulier") ? "Particulier" : "Copropriété"}</span>;
  };

  return (
    <Modal title="Requalifier les réservations à nom libre" onClose={onClose} width={860}>
      <p className="help" style={{ marginBottom: 10 }}>
        Les réservations importées sont toutes arrivées en « copropriété », donc facturées au prix fixe de la salle.
        Un anniversaire ou un musicien doit être un <b>particulier</b> : heures × tarif horaire. Un événement de la
        maison doit être <b>interne</b> : il ne sera plus jamais proposé à facturer. Le choix s'applique à toutes les
        réservations portant le même nom, et reste annulable avec ↶.
      </p>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="planner-field" placeholder="Filtrer les noms (ANNIV, FETE…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="link" onClick={() => tout("particulier")}>Tout en particulier</button>
        <button className="link" onClick={() => tout("interne")}>Tout en interne</button>
        <button className="link" onClick={() => setSel({})}>Effacer les choix</button>
      </div>
      {noms.length === 0 && <p className="help">Aucune réservation à nom libre cette année.</p>}
      {noms.length > 0 && (
        <div style={{ maxHeight: "52vh", overflow: "auto" }}>
          <table className="table"><tbody>
            {vus.map((e) => (
              <tr key={e.nom}>
                <td><b>{e.nom}</b><br /><span className="help">{e.n} réservation{e.n > 1 ? "s" : ""}{e.serie ? " · série" : ""}{e.dates.length ? ` · à partir du ${frShort(e.dates[0])}` : ""}</span></td>
                <td>{etat(e)}</td>
                <td style={{ textAlign: "right" }}>
                  <select className="planner-field" style={{ width: 230 }} value={sel[e.nom] || ""} onChange={(ev) => setSel({ ...sel, [e.nom]: ev.target.value })}>
                    {CHOIX.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {vus.length === 0 && <tr><td className="help">Aucun nom ne correspond à « {q.trim()} ».</td></tr>}
          </tbody></table>
        </div>
      )}
      <div className="row" style={{ marginTop: 12, justifyContent: "flex-end", alignItems: "center" }}>
        <span className="help">{poses.length === 0 ? "Aucun changement" : `${poses.length} nom(s) · ${touche} réservation(s)`}</span>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={poses.length === 0} onClick={appliquer}>Appliquer</button>
      </div>
    </Modal>
  );
}
