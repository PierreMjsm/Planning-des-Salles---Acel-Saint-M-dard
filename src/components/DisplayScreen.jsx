import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { PALETTE } from "../lib/planner/constants.js";
import { sessionName, toMin, activeSessions, groupActivities } from "../lib/planner/occurrences.js";
import { keyOf, frLong } from "../lib/planner/dates.js";
import { isNight } from "../lib/planner/displayshare.js";

// Écran d'affichage pour le hall : ce qui se passe en ce moment, ce qui suit, et
// par intermittence la journée entière. Pensé pour être lu de loin et diffusé sur
// une télévision. Aucune information interne n'y figure.
const PHASES = ["now", "next", "day", "now", "next"];   // la journée entière revient toutes les trois rotations
const TURN = 12000;

const tone = (i) => PALETTE[(i || 0) % PALETTE.length];
const hm = (t) => String(t || "").replace(":", "h");


export default function DisplayScreen({ onClose, data, standalone }) {
  const ctx = usePlanner();
  const P = data || ctx;
  const [now, setNow] = useState(() => new Date());
  const [phase, setPhase] = useState(0);
  const box = useRef(null);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setPhase((i) => (i + 1) % PHASES.length), TURN); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", h);
    if (!standalone) { try { if (box.current && box.current.requestFullscreen) box.current.requestFullscreen().catch(() => {}); } catch (e) { /* refusé par le navigateur */ } }
    return () => { window.removeEventListener("keydown", h); try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {} };
  }, [onClose, standalone]);

  // Le jour vient de la même horloge que l'heure affichée : à minuit, l'en-tête,
  // les séances et les filtres basculent ensemble.
  const today = keyOf(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  const night = isNight(mins, P.org.displayNightFrom, P.org.displayNightTo);
  const heure = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // Une activité par réservation, comme sur la Fiche du jour : une réservation cochée
  // sur plusieurs salles, ou un stage réparti sur plusieurs salles, ne s'affiche
  // qu'une fois, avec la liste de ses salles.
  const day = useMemo(() => {
    const raw = activeSessions(P.allSessions(today, today));
    const groups = groupActivities(raw, P.rooms, P.db ? P.db.Stage : []);
    const room = (id) => P.rooms.find((r) => r.id === id) || {};
    return groups.map(({ s, rooms }) => {
      const noms = rooms.map((r) => r.name).filter(Boolean);
      // le chemin d'accès n'a de sens que s'il est le même pour toutes les salles
      const acces = [...new Set(rooms.map((r) => r.accessInfo || "").filter(Boolean))];
      return {
        key: s.id, name: sessionName(s, P.allAssociations), start: s.start, end: s.end,
        roomName: noms.join(" · ") || room(s.roomId).name || "",
        access: acces.length === 1 ? acces[0] : "",
        tone: tone((P.allAssociations.find((a) => a.id === s.associationId) || rooms[0] || room(s.roomId) || {}).colorIdx),
        from: toMin(s.start) ?? 0, to: toMin(s.end) ?? 0,
      };
    }).sort((a, b) => a.from - b.from || a.roomName.localeCompare(b.roomName));
  }, [P.allSessions, P.rooms, P.allAssociations, P.db, today]);

  const current = day.filter((s) => s.from <= mins && mins < s.to);
  const coming = day.filter((s) => s.from > mins).slice(0, 6);
  const closed = P.dayNoteFor(today)?.closed;
  const kind = closed ? "closed" : PHASES[phase];
  const shown = kind === "closed" ? [] : kind === "now" ? current : kind === "next" ? coming : day;
  const title = kind === "closed" ? "La maison est fermée aujourd'hui" : kind === "now" ? "En ce moment" : kind === "next" ? "Prochainement" : "Toute la journée";
  // moins il y a d'activités à l'écran, plus les caractères sont grands
  const n = shown.length;
  const gridClass = kind === "day" && n > 8 ? " display-grid-day" : n <= 1 ? " few-1" : n === 2 ? " few-2" : n <= 4 ? " few-4" : " few-8";
  // Fond clair par défaut : sur une télévision de hall, les blocs de couleur se
  // repèrent de plus loin. Le fond sombre reste possible (Réglages › Organisation).
  const theme = P.org.displayTheme === "dark" ? "dark" : "light";
  const light = theme === "light";

  // La nuit, l'écran s'éteint : il reste noir jusqu'à l'heure de reprise.
  if (night) return (
    <div className="display display-night" data-theme="dark" ref={box} aria-label="Écran en veille">
      <span className="display-night-clock">{heure}</span>
      {onClose && <button className="display-close no-print" onClick={onClose} aria-label="Quitter l'affichage">✕</button>}
    </div>
  );

  return (
    <div className="display" data-theme={theme} ref={box}>
      <header className="display-head">
        <div>
          <div className="display-org">{P.org.displayTitle || P.org.name}</div>
          <div className="display-date">{frLong(today)}</div>
        </div>
        <div className="display-clock">{heure}</div>
        {onClose && <button className="display-close no-print" onClick={onClose} aria-label="Quitter l'affichage">✕</button>}
      </header>
      <h1 className="display-title">{title}</h1>
      <div className={"display-grid" + gridClass}>
        {shown.map((s) => (
          <article key={s.key + kind} className="display-card"
            style={light ? { background: s.tone.bg, borderLeftColor: s.tone.border, color: s.tone.text } : { borderLeftColor: s.tone.border }}>
            <div className="display-when">{hm(s.start)} – {hm(s.end)}</div>
            <div className="display-name">{s.name}</div>
            <div className="display-room"><span className="display-chip" style={light ? { background: s.tone.text } : null}>{s.roomName}</span></div>
            {kind !== "day" && s.access && <div className="display-access">→ {s.access}</div>}
          </article>
        ))}
        {shown.length === 0 && (
          <p className="display-empty">{kind === "closed" ? "Rendez-vous demain." : kind === "now" ? "Aucune activité en cours." : kind === "next" ? "Plus rien de prévu aujourd'hui." : "Aucune activité aujourd'hui."}</p>
        )}
      </div>
      <footer className="display-foot">
        {PHASES.map((_, i) => <span key={i} className={"display-dot" + (i === phase ? " on" : "")} />)}
        <span className="display-hint">{standalone ? "Fenêtre d'affichage" : "Échap pour quitter"}</span>
      </footer>
    </div>
  );
}
