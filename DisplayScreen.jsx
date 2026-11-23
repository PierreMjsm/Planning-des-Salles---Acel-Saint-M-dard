import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { PALETTE } from "../lib/planner/constants.js";
import { sessionName, toMin, activeSessions } from "../lib/planner/occurrences.js";
import { todayKey, frLong } from "../lib/planner/dates.js";

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

  const today = todayKey();
  const mins = now.getHours() * 60 + now.getMinutes();
  const day = useMemo(() => {
    const list = activeSessions(P.allSessions(today, today)).filter((s) => !s.multi || s.primaryRoom);
    const room = (id) => P.rooms.find((r) => r.id === id) || {};
    return list.map((s) => ({
      key: s.id, name: sessionName(s, P.allAssociations), start: s.start, end: s.end,
      roomName: room(s.roomId).name || "", access: room(s.roomId).accessInfo || "",
      rooms: s.roomIds && s.roomIds.length > 1 ? s.roomIds.map((id) => room(id).name).filter(Boolean).join(" · ") : "",
      tone: tone((P.allAssociations.find((a) => a.id === s.associationId) || room(s.roomId) || {}).colorIdx),
      from: toMin(s.start) ?? 0, to: toMin(s.end) ?? 0,
    })).sort((a, b) => a.from - b.from || a.roomName.localeCompare(b.roomName));
  }, [P.allSessions, P.rooms, P.allAssociations, today]);

  const current = day.filter((s) => s.from <= mins && mins < s.to);
  const coming = day.filter((s) => s.from > mins).slice(0, 6);
  const closed = P.dayNoteFor(today)?.closed;
  const kind = closed ? "closed" : PHASES[phase];
  const shown = kind === "closed" ? [] : kind === "now" ? current : kind === "next" ? coming : day;
  const title = kind === "closed" ? "La maison est fermée aujourd'hui" : kind === "now" ? "En ce moment" : kind === "next" ? "Prochainement" : "Toute la journée";
  const heure = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // moins il y a d'activités à l'écran, plus les caractères sont grands
  const n = shown.length;
  const gridClass = kind === "day" && n > 8 ? " display-grid-day" : n <= 1 ? " few-1" : n === 2 ? " few-2" : n <= 4 ? " few-4" : " few-8";
  // Fond clair par défaut : sur une télévision de hall, les blocs de couleur se
  // repèrent de plus loin. Le fond sombre reste possible (Réglages › Organisation).
  const theme = P.org.displayTheme === "dark" ? "dark" : "light";
  const light = theme === "light";

  return (
    <div className="display" data-theme={theme} ref={box}>
      <header className="display-head">
        <div>
          <div className="display-org">{P.org.name}</div>
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
            <div className="display-room"><span className="display-chip" style={light ? { background: s.tone.text } : null}>{s.rooms || s.roomName}</span></div>
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
