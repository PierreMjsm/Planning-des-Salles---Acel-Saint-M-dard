import React, { useEffect, useMemo, useState } from "react";
import DisplayScreen from "../components/DisplayScreen.jsx";
import { loadAll } from "../lib/planner/store.js";
import { sessionsInRange } from "../lib/planner/occurrences.js";
import { DEFAULT_ORG } from "../lib/planner/constants.js";

// La fenêtre posée sur la télévision du hall. Elle ne fait que lire : aucune
// écriture, aucune synchronisation, pour ne jamais gêner le poste de travail.
// Les données sont relues régulièrement, donc ce que l'on saisit côté bureau
// apparaît sur l'écran dans la minute.
const RELOAD = 30000;

// On lit d'abord le fichier partagé, qui fait foi pour les deux postes ; à défaut
// la mémoire locale de l'application. Deux fenêtres ne partagent pas toujours
// cette mémoire, le fichier est donc la source la plus sûre.
async function read() {
  const fs = typeof window !== "undefined" && window.salleplanFS;
  if (fs && fs.readData) {
    try {
      const r = await fs.readData();
      if (r && r.ok && r.data && Array.isArray(r.data.Room) && r.data.Room.length) return r.data;
    } catch (e) { /* on retombe sur la mémoire locale */ }
  }
  return loadAll();
}

export default function DisplayStandalone() {
  const [db, setDb] = useState(() => loadAll());
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    let alive = true;
    const pull = async () => { const d = await read(); if (!alive) return; setDb(d); setEmpty(!(d.Room || []).length); };
    pull();
    const t = setInterval(pull, RELOAD);
    window.addEventListener("storage", pull);   // l'autre fenêtre vient d'écrire
    return () => { alive = false; clearInterval(t); window.removeEventListener("storage", pull); };
  }, []);

  const data = useMemo(() => {
    const org = { ...DEFAULT_ORG };
    const stored = (db.OrganisationSettings || [])[0] || {};
    for (const k of Object.keys(stored)) if (stored[k] !== undefined && stored[k] !== "" && stored[k] !== null) org[k] = stored[k];
    const notes = new Map((db.DayNote || []).map((n) => [n.date, n]));
    return {
      rooms: db.Room || [], allAssociations: db.Association || [], org,
      dayNoteFor: (d) => notes.get(d) || null,
      allSessions: (from, to) => sessionsInRange(db.Booking || [], db.RecurringBooking || [], from, to, db.Vacation || []),
    };
  }, [db]);

  if (empty) return (
    <div className="display"><div className="display-head"><div className="display-org">Affichage du hall</div></div>
      <p className="display-empty" style={{ marginTop: "6vh" }}>Les données ne sont pas lisibles depuis cette fenêtre.<br />Vérifiez le dossier partagé dans Réglages, puis rouvrez l'affichage.</p></div>
  );
  return <DisplayScreen data={data} standalone />;
}
