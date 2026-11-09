import React, { useState } from "react";
import { PlannerProvider, usePlanner } from "./lib/planner/PlannerContext.jsx";
import { ACTORS } from "./lib/planner/actor.js";
import { yearLabel } from "./lib/planner/dates.js";
import Planning from "./pages/Planning.jsx";
import Facturation from "./pages/Facturation.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Historique from "./pages/Historique.jsx";
import Dossier from "./pages/Dossier.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

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

const PAGES = [["planning", "Planning", "📅", Planning], ["facturation", "Facturation", "🧾", Facturation], ["dashboard", "Tableau de bord", "📊", Dashboard], ["historique", "Historique", "🕘", Historique], ["dossier", "Dossier", "📖", Dossier]];

function Shell() {
  const P = usePlanner();
  const [page, setPage] = useState("planning");
  const [settings, setSettings] = useState(false);
  if (!P.actor) return <ActorGate />;
  const Page = PAGES.find((p) => p[0] === page)[3];
  return (
    <div>
      <header className="no-print" style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(251,248,241,0.94)", backdropFilter: "blur(6px)", borderBottom: "1px solid var(--border)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <b className="serif" style={{ fontSize: 18, color: "var(--primary)" }}>Planning des salles</b>
        <nav style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" }}>{PAGES.map(([k, l, ic]) => <button key={k} className={"nav-pill" + (page === k ? " active" : "")} onClick={() => setPage(k)}><span>{ic}</span><span className="nav-label">{l}</span></button>)}</nav>
        <select className="planner-field" style={{ width: 90 }} value={P.actor} onChange={(e) => P.setActor(e.target.value)} title="Profil">{ACTORS.map((a) => <option key={a}>{a}</option>)}</select>
        <select className="planner-field" style={{ width: 120 }} value={P.year} onChange={(e) => P.setYear(Number(e.target.value))} title="Année scolaire">{P.years.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}</select>
        <button className="btn" onClick={() => setSettings(true)}>⚙ Réglages</button>
      </header>
      <main style={{ padding: 16, maxWidth: 1600, margin: "0 auto" }}><Page /></main>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {P.toast && <div className={"toast no-print" + (P.toast.kind === "error" ? " error" : "")}>{P.toast.message}</div>}
    </div>
  );
}

export default function App() { return <PlannerProvider><Shell /></PlannerProvider>; }
