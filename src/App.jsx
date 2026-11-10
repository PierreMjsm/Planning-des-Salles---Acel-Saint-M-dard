import React, { useState } from "react";
import { PlannerProvider, usePlanner } from "./lib/planner/PlannerContext.jsx";
import { ACTORS } from "./lib/planner/actor.js";
import { yearLabel } from "./lib/planner/dates.js";
import Planning from "./pages/Planning.jsx";
import Facturation from "./pages/Facturation.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Historique from "./pages/Historique.jsx";
import Dossier from "./pages/Dossier.jsx";
import Traiter, { useTodoCounts } from "./pages/Traiter.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { Modal } from "./components/ui.jsx";

function ActorGate() {
  const P = usePlanner();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ textAlign: "center", padding: 32, maxWidth: 380 }}>
        <h1 className="serif" style={{ marginBottom: 6 }}>Planning des salles</h1>
        <p className="help" style={{ marginBottom: 18 }}>Qui utilise le planning ? Vos modifications seront signées dans l'historique.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>{ACTORS.map((a) => <button key={a} className="btn btn-primary" style={{ height: 46, minWidth: 120, fontSize: 15 }} onClick={() => P.setActor(a)}>{a}</button>)}</div>
      </div>
    </div>
  );
}

const SHORTCUTS = [["N", "Nouvelle réservation"], ["T", "Aujourd'hui"], ["← / →", "Période précédente / suivante"], ["1 2 3 4", "Vues Par salle, Mois, Semaine, Jour"], ["/", "Rechercher"], ["Ctrl + Z", "Annuler la dernière action"], ["?", "Afficher cette aide"]];

function SyncChip() {
  const P = usePlanner(); const s = P.sync;
  if (!s.enabled) return null;
  const txt = { saved: "Données enregistrées", saving: "Enregistrement…", conflict: "Conflit de données", error: "Erreur d'enregistrement", local: "" }[s.status] || "";
  const bad = s.status === "conflict" || s.status === "error";
  return <span title={(s.shared ? "Dossier partagé : " : "Dossier : ") + s.dir + (s.error ? "\n" + s.error : "")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: bad ? "#FCEBEB" : "#E3EFE9", color: bad ? "#791F1F" : "#085041" }}>{s.shared ? "☁ " : "💾 "}{txt}{s.others && s.others.length > 0 && <b style={{ marginLeft: 8 }}>· {s.others.join(", ")} {s.others.length > 1 ? "sont connectés" : "est connecté(e)"}</b>}</span>;
}

function ConflictBanner() {
  const P = usePlanner(); const s = P.sync;
  if (!s.enabled || s.status !== "conflict") return null;
  return (
    <div className="banner banner-red no-print" style={{ margin: "10px 16px 0" }}>
      <b>Les données ont été modifiées sur un autre poste{s.remoteBy ? ` (${s.remoteBy})` : ""}</b> pendant que vous travailliez. Que faire ?{" "}
      <button className="link" onClick={() => P.ask("Recharger les données partagées ? Vos dernières modifications non enregistrées seront perdues.", () => P.reloadRemote())}>Recharger les données de l'autre poste</button>
      <button className="link link-danger" onClick={() => P.ask("Écraser les données partagées par celles de cet ordinateur ?", () => P.overwriteRemote())}>Garder mes données (écraser)</button>
    </div>
  );
}

const PAGES = [["planning", "Planning", "📅", Planning], ["traiter", "À traiter", "✅", Traiter], ["facturation", "Relevés de frais", "🧾", Facturation], ["dashboard", "Tableau de bord", "📊", Dashboard], ["historique", "Historique", "🕘", Historique], ["dossier", "Dossier", "📖", Dossier]];

function Shell() {
  const P = usePlanner();
  const [page, setPage] = useState("planning");
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const todo = useTodoCounts();
  const [zoomLvl, setZoomLvl] = useState(() => { try { return Number(window.localStorage.getItem("salleplan.ui.zoom")) || 100; } catch (e) { return 100; } });
  const setZoom = (d) => setZoomLvl((z) => { const n = Math.max(80, Math.min(140, z + d * 10)); try { window.localStorage.setItem("salleplan.ui.zoom", String(n)); } catch (e) { /* ignoré */ } return n; });
  React.useEffect(() => { document.documentElement.style.zoom = zoomLvl === 100 ? "" : String(zoomLvl / 100); }, [zoomLvl]);
  React.useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !["input", "textarea", "select"].includes(tag)) { e.preventDefault(); P.undo(); return; }
      if (["input", "textarea", "select"].includes(tag) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".overlay")) return;
      if (e.key === "?") { setHelp(true); return; }
      window.dispatchEvent(new CustomEvent("salleplan:key", { detail: e.key }));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [P.undo]);
  if (!P.actor) return <ActorGate />;
  const Page = PAGES.find((p) => p[0] === page)[3];
  const badge = (k) => (k === "traiter" ? todo.pending + todo.conflicts : 0);
  return (
    <div>
      <header className="no-print" style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(251,248,241,0.94)", backdropFilter: "blur(6px)", borderBottom: "1px solid var(--border)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <b className="serif" style={{ fontSize: 18, color: "var(--primary)" }}>Planning des salles</b>
        <nav style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" }}>{PAGES.map(([k, l, ic]) => <button key={k} className={"nav-pill" + (page === k ? " active" : "")} onClick={() => setPage(k)}><span>{ic}</span><span className="nav-label">{l}</span>{badge(k) > 0 && <span style={{ background: "#E24B4A", color: "#fff", borderRadius: 999, fontSize: 11, padding: "0 6px", fontWeight: 700 }}>{badge(k)}</span>}</button>)}</nav>
        <SyncChip />
        <button className="btn btn-icon" title="Annuler la dernière action (Ctrl+Z)" onClick={P.undo}>↶</button>
        <button className="btn btn-icon" title="Texte plus petit" onClick={() => setZoom(-1)}>A−</button><button className="btn btn-icon" title="Texte plus grand" onClick={() => setZoom(1)}>A+</button>
        <button className="btn btn-icon" title="Raccourcis clavier (?)" onClick={() => setHelp(true)}>?</button>
        <select className="planner-field" style={{ width: 90 }} value={P.actor} onChange={(e) => P.setActor(e.target.value)} title="Profil">{ACTORS.map((a) => <option key={a}>{a}</option>)}</select>
        <select className="planner-field" style={{ width: 120 }} value={P.year} onChange={(e) => P.setYear(Number(e.target.value))} title="Année scolaire">{P.years.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}</select>
        <button className="btn" onClick={() => setSettings(true)}>⚙ Réglages</button>
      </header>
      <ConflictBanner />
      <main className="app-main" style={{ maxWidth: 1600, margin: "0 auto" }}><Page goPlanning={() => setPage("planning")} /></main>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {help && <Modal title="Raccourcis clavier" onClose={() => setHelp(false)} width={420}><table className="table"><tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><td style={{ width: 110 }}><b>{k}</b></td><td>{d}</td></tr>)}</tbody></table></Modal>}
      {P.dialog && (
        <div className="overlay no-print" style={{ zIndex: 120 }}>
          <div className="modal" style={{ maxWidth: 420, padding: 20 }}>
            <p style={{ marginBottom: 16, fontSize: 15 }}>{P.dialog.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => { const f = P.dialog.onNo; P.closeDialog(); if (f) f(); }}>Annuler</button>
              <button className="btn btn-primary" autoFocus onClick={() => { const f = P.dialog.onYes; P.closeDialog(); f(); }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
      {P.toast && <div className={"toast no-print" + (P.toast.kind === "error" ? " error" : "")}>{P.toast.message}{P.toast.action && <button onClick={() => { P.toast.action.run(); }} style={{ marginLeft: 14, background: "#fff", color: "#2B2620", border: "none", borderRadius: 6, padding: "3px 10px", fontWeight: 700, cursor: "pointer" }}>{P.toast.action.label}</button>}</div>}
    </div>
  );
}

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: 32, maxWidth: 560, margin: "40px auto" }} className="card">
        <h2 className="serif">Un problème est survenu</h2>
        <p className="help" style={{ margin: "8px 0 14px" }}>{String(this.state.err && this.state.err.message)}</p>
        <button className="btn btn-primary" onClick={() => { this.setState({ err: null }); }}>Revenir au planning</button>
      </div>
    );
  }
}

export default function App() { return <Boundary><PlannerProvider><Shell /></PlannerProvider></Boundary>; }
