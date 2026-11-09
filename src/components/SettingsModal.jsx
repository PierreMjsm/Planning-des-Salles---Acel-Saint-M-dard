import React, { useRef, useState } from "react";
import { Modal, Field } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { PALETTE, FREQUENCY_LABELS, WEEKDAYS } from "../lib/planner/constants.js";
import { yearLabel, frShort } from "../lib/planner/dates.js";

const Swatches = ({ value, onChange }) => (
  <span style={{ display: "inline-flex", gap: 3 }}>{PALETTE.map((c, i) => <button key={i} title={c.name} onClick={() => onChange(i)} style={{ width: 18, height: 18, borderRadius: 9, background: c.bg, border: `2px solid ${value === i ? "#222" : c.border}`, padding: 0 }} />)}</span>
);
const Num = ({ value, onSave, placeholder, w = 80 }) => { const [v, setV] = useState(value ?? ""); return <input className="planner-field" style={{ width: w }} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v === "" ? null : Number(String(v).replace(",", ".")))} />; };

function Rooms() {
  const P = usePlanner(); const [n, setN] = useState("");
  return (<div>
    <div className="row" style={{ marginBottom: 10 }}><input className="planner-field" placeholder="Nouvelle salle" value={n} onChange={(e) => setN(e.target.value)} /><button className="btn" style={{ flex: "0 0 auto" }} onClick={() => { P.addRoom(n); setN(""); }}>Ajouter</button></div>
    {P.rooms.map((r) => (
      <div key={r.id} className="card" style={{ padding: 10, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="planner-field" style={{ flex: 1, minWidth: 150 }} defaultValue={r.name} onBlur={(e) => e.target.value.trim() && e.target.value !== r.name && P.updateRoom(r.id, { name: e.target.value.trim() })} />
          <Swatches value={r.colorIdx} onChange={(i) => P.updateRoom(r.id, { colorIdx: i })} />
          <button className="link link-danger" onClick={() => window.confirm(`Supprimer « ${r.name} » et ses réservations ?`) && P.deleteRoom(r.id)}>Supprimer</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
          <span className="help">€/h</span><Num value={r.rate} placeholder="Tarif" onSave={(v) => P.updateRoom(r.id, { rate: v ?? 0 })} />
          <span className="help">Week-end</span><Num value={r.rateWeekend} placeholder="—" onSave={(v) => P.updateRoom(r.id, { rateWeekend: v })} />
          <span className="help">Externe</span><Num value={r.rateExternal} placeholder="—" onSave={(v) => P.updateRoom(r.id, { rateExternal: v })} />
          <span className="help">Capacité</span><Num value={r.capacity} placeholder="—" onSave={(v) => P.updateRoom(r.id, { capacity: v })} w={70} />
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <input className="planner-field" placeholder="Matériel (séparé par des virgules)" defaultValue={(r.equipmentList || []).join(", ")} onBlur={(e) => P.updateRoom(r.id, { equipmentList: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
          <input className="planner-field" placeholder="Comment accéder à la salle" defaultValue={r.accessInfo || ""} onBlur={(e) => e.target.value !== (r.accessInfo || "") && P.updateRoom(r.id, { accessInfo: e.target.value })} />
        </div>
      </div>))}
  </div>);
}

function Assocs() {
  const P = usePlanner(); const [n, setN] = useState("");
  return (<div>
    <div className="row" style={{ marginBottom: 10 }}><input className="planner-field" placeholder="Nouvelle association" value={n} onChange={(e) => setN(e.target.value)} /><button className="btn" style={{ flex: "0 0 auto" }} onClick={() => { P.addAssociation(n); setN(""); }}>Ajouter</button><button className="btn" style={{ flex: "0 0 auto" }} onClick={P.copyPreviousYearAssociations}>Copier {yearLabel(P.year - 1)}</button></div>
    {P.associations.map((a) => (
      <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}>
        <input className="planner-field" style={{ flex: 1, minWidth: 160 }} defaultValue={a.name} onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && P.updateAssociation(a.id, { name: e.target.value.trim() })} />
        <Swatches value={a.colorIdx} onChange={(i) => P.updateAssociation(a.id, { colorIdx: i })} />
        <label className="help"><input type="checkbox" checked={!!a.isExternal} onChange={(e) => P.updateAssociation(a.id, { isExternal: e.target.checked })} /> Externe</label>
        <span className="help">Coef %</span><Num value={a.rateCoef} w={64} onSave={(v) => P.updateAssociation(a.id, { rateCoef: v ?? 100 })} />
        <button className="link link-danger" onClick={() => window.confirm(`Supprimer « ${a.name} » ?`) && P.deleteAssociation(a.id)}>Supprimer</button>
      </div>))}
  </div>);
}

function Closures() {
  const P = usePlanner(); const [f, setF] = useState({ label: "", startDate: "", endDate: "", roomId: "" });
  const add = () => { if (!f.label.trim() || !f.startDate) return P.notify("Motif et date de début requis", "error"); P.addClosure({ ...f, label: f.label.trim(), endDate: f.endDate || f.startDate, roomId: f.roomId || "" }); setF({ label: "", startDate: "", endDate: "", roomId: "" }); };
  return (<div>
    <div className="row" style={{ marginBottom: 10 }}>
      <input className="planner-field" placeholder="Motif (ex. Travaux)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      <input type="date" className="planner-field" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
      <input type="date" className="planner-field" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
      <select className="planner-field" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">Toutes les salles</option>{P.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <button className="btn" style={{ flex: "0 0 auto" }} onClick={add}>Ajouter</button></div>
    {P.closures.length === 0 && <p className="help">Aucune fermeture.</p>}
    {P.closures.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}><span><b>{c.label}</b> · {frShort(c.startDate)} → {frShort(c.endDate)} · {P.rooms.find((r) => r.id === c.roomId)?.name || "Toutes les salles"}</span><button className="link link-danger" onClick={() => P.deleteClosure(c.id)}>Supprimer</button></div>)}
  </div>);
}

function Series() {
  const P = usePlanner();
  const nm = (s) => P.associations.find((a) => a.id === s.associationId)?.name || s.customName || "Série";
  return (<div>{P.recurring.length === 0 && <p className="help">Aucune série cette année.</p>}
    {P.recurring.map((s) => <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #F0E9D9", flexWrap: "wrap" }}>
      <span><b>{nm(s)}</b> · {FREQUENCY_LABELS[s.frequency]}{s.frequency === "weekly" ? ` (${WEEKDAYS[s.weekday]})` : ""} · {s.start}–{s.end} · {P.rooms.find((r) => r.id === s.roomId)?.name}<br /><span className="help">{frShort(s.startDate)} → {frShort(s.endDate)} · {(s.exceptions || []).length} séance(s) annulée(s)</span></span>
      <span><button className="link" onClick={() => P.updateRecurringFields(s.id, { status: "confirme" })}>Valider</button><button className="link" onClick={() => P.updateRecurringFields(s.id, { paymentStatus: "paid" })}>Payé</button><button className="link link-danger" onClick={() => window.confirm("Supprimer cette série ?") && P.deleteRecurring(s.id)}>Supprimer</button></span></div>)}</div>);
}

function Templates() {
  const P = usePlanner();
  return (<div>{P.templates.length === 0 && <p className="help">Aucun modèle. Enregistrez-en un depuis le formulaire de réservation.</p>}
    {P.templates.map((t) => <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}><span><b>{t.name}</b> · {t.start}–{t.end} · {P.rooms.find((r) => r.id === t.roomId)?.name || ""}</span><button className="link link-danger" onClick={() => P.deleteTemplate(t.id)}>Supprimer</button></div>)}</div>);
}

function Org() {
  const P = usePlanner(); const o = P.org; const file = useRef();
  const [f, setF] = useState({ name: o.name || "", address: o.address || "", legal: o.legal || "", invoicePrefix: o.invoicePrefix || "FACT", nextInvoiceNumber: o.nextInvoiceNumber || 1 });
  const onFile = (e) => { const fl = e.target.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => { try { if (window.confirm("Remplacer toutes les données actuelles par cette sauvegarde ?")) P.importBackup(String(r.result)); } catch (err) { P.notify("Fichier de sauvegarde invalide", "error"); } }; r.readAsText(fl); e.target.value = ""; };
  return (<div>
    <Field label="Nom de l'organisation"><input className="planner-field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
    <Field label="Adresse"><textarea className="planner-field" rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
    <Field label="Mentions légales (pied de facture)"><textarea className="planner-field" rows={3} value={f.legal} onChange={(e) => setF({ ...f, legal: e.target.value })} /></Field>
    <div className="row"><Field label="Préfixe de facture"><input className="planner-field" value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value })} /></Field><Field label="Prochain numéro"><input type="number" min="1" className="planner-field" value={f.nextInvoiceNumber} onChange={(e) => setF({ ...f, nextInvoiceNumber: Number(e.target.value) })} /></Field></div>
    <button className="btn btn-primary" onClick={() => P.updateOrg({ ...f, nextInvoiceNumber: Number(f.nextInvoiceNumber) || 1 })}>Enregistrer</button>
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }}>
      <h3 className="serif" style={{ marginBottom: 6 }}>Sauvegarde</h3>
      <p className="help" style={{ marginBottom: 8 }}>Les données sont enregistrées sur cet ordinateur. Exportez régulièrement une sauvegarde JSON ; importez-la sur un autre poste pour y retrouver les mêmes données.</p>
      <div style={{ display: "flex", gap: 8 }}><button className="btn" onClick={P.exportBackup}>Exporter la sauvegarde</button><button className="btn" onClick={() => file.current.click()}>Importer une sauvegarde</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} /></div>
    </div></div>);
}

export default function SettingsModal({ onClose }) {
  const [tab, setTab] = useState("rooms");
  const tabs = [["rooms", "Salles", Rooms], ["assoc", "Associations", Assocs], ["closures", "Fermetures", Closures], ["series", "Récurrences", Series], ["tpl", "Modèles", Templates], ["org", "Organisation", Org]];
  const Cur = tabs.find((t) => t[0] === tab)[2];
  return (
    <Modal title="Réglages" onClose={onClose} width={860}>
      <div className="seg" style={{ marginBottom: 12, flexWrap: "wrap" }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      <Cur />
    </Modal>
  );
}
