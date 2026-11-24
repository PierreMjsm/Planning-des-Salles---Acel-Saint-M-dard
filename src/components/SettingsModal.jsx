import React, { useState, useMemo, useEffect } from "react";
import { Modal, Field, NumInput, DateInput } from "./ui.jsx";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { PALETTE, FREQUENCY_LABELS, WEEKDAYS, DEFAULT_OPEN_START, DEFAULT_OPEN_END, bafaOrganism, CONVENTION_SECTIONS, SEED_TEMPLATES } from "../lib/planner/constants.js";
import { yearLabel, frShort, yearBounds } from "../lib/planner/dates.js";
import { KINDS } from "../lib/planner/statements.js";
import { roomConvention } from "../lib/planner/convention.js";
import { FREQS, freqOf } from "../lib/planner/billing.js";
import StageModal from "./StageModal.jsx";
import { canListBackups, listBackups, readBackup, canArchiveYears, listArchives, readArchive, openArchives } from "../lib/planner/sync.js";

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
          <button className="link link-danger" onClick={() => P.ask(`Supprimer « ${r.name} » et ses réservations ?`, () => P.deleteRoom(r.id))}>Supprimer</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
          <span className="help">€/h</span><Num value={r.rate} placeholder="Tarif" onSave={(v) => P.updateRoom(r.id, { rate: v ?? 0 })} />
          <span className="help">Week-end</span><Num value={r.rateWeekend} placeholder="—" onSave={(v) => P.updateRoom(r.id, { rateWeekend: v })} />
          <span className="help">Externe</span><Num value={r.rateExternal} placeholder="—" onSave={(v) => P.updateRoom(r.id, { rateExternal: v })} />
          <span className="help" title="Montant du relevé d'une copropriété dans cette salle">Prix copro €</span><Num value={r.copropPrice} placeholder="375" onSave={(v) => P.updateRoom(r.id, { copropPrice: v })} w={70} />
          <span className="help">Capacité</span><Num value={r.capacity} placeholder="—" onSave={(v) => P.updateRoom(r.id, { capacity: v })} w={70} />
          <span className="help" title="Sert au calcul du taux d'occupation">Ouverture</span>
          <input type="time" className="planner-field" style={{ width: 104 }} value={r.openStart || DEFAULT_OPEN_START} onChange={(e) => P.updateRoom(r.id, { openStart: e.target.value })} aria-label={`Ouverture de ${r.name}`} />
          <input type="time" className="planner-field" style={{ width: 104 }} value={r.openEnd || DEFAULT_OPEN_END} onChange={(e) => P.updateRoom(r.id, { openEnd: e.target.value })} aria-label={`Fermeture de ${r.name}`} />
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <input className="planner-field" placeholder="Matériel (séparé par des virgules)" defaultValue={(r.equipmentList || []).join(", ")} onBlur={(e) => P.updateRoom(r.id, { equipmentList: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
          <input className="planner-field" placeholder="Comment accéder à la salle" defaultValue={r.accessInfo || ""} onBlur={(e) => e.target.value !== (r.accessInfo || "") && P.updateRoom(r.id, { accessInfo: e.target.value })} />
          <select className="planner-field" style={{ width: 150 }} value={String(r.turnaround || 0)} onChange={(e) => P.updateRoom(r.id, { turnaround: Number(e.target.value) })} aria-label={`Battement de ${r.name}`} title="Temps entre deux groupes, pour éviter qu'ils se croisent">
            <option value="0">Sans battement</option><option value="15">Battement 15 min</option><option value="30">Battement 30 min</option>
          </select>
        </div>
        <div className="row" style={{ alignItems: "center", gap: 6 }}>
          <span className="help" title="Tableau des tarifs de la demande de mise à disposition">Convention :</span>
          <select className="planner-field" style={{ width: 190 }} value={roomConvention(r).section} onChange={(e) => P.updateRoom(r.id, { conventionSection: e.target.value })} aria-label={`Section de ${r.name}`}>
            <option value="">Hors tableau</option>
            {CONVENTION_SECTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="planner-field" style={{ width: 140 }} placeholder="Zone (ex. CENSIER)" defaultValue={roomConvention(r).zone} onBlur={(e) => e.target.value !== roomConvention(r).zone && P.updateRoom(r.id, { conventionZone: e.target.value })} aria-label={`Zone de ${r.name}`} />
          <input className="planner-field" style={{ flex: 1, minWidth: 160 }} placeholder="Intitulé sur la convention" defaultValue={roomConvention(r).label === r.name ? "" : roomConvention(r).label} onBlur={(e) => e.target.value !== (r.conventionLabel || "") && P.updateRoom(r.id, { conventionLabel: e.target.value })} aria-label={`Intitulé de ${r.name}`} />
        </div>
      </div>))}
  </div>);
}

function AssocRow({ a }) {
  const P = usePlanner(); const [open, setOpen] = useState(false);
  const known = bafaOrganism(a.name);
  return (
    <div style={{ padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input className="planner-field" style={{ flex: 1, minWidth: 160 }} defaultValue={a.name} onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && P.updateAssociation(a.id, { name: e.target.value.trim() })} />
        <Swatches value={a.colorIdx} onChange={(i) => P.updateAssociation(a.id, { colorIdx: i })} />
        <label className="help"><input type="checkbox" checked={!!a.isExternal} onChange={(e) => P.updateAssociation(a.id, { isExternal: e.target.checked })} /> Externe</label>
        <span className="help">Coef %</span><Num value={a.rateCoef} w={64} onSave={(v) => P.updateAssociation(a.id, { rateCoef: v ?? 100 })} />
        <button className="link" onClick={() => setOpen(!open)}>{open ? "Masquer" : "Relevé de frais"}</button>
        <button className="link link-danger" onClick={() => P.ask(`Supprimer « ${a.name} » ?`, () => P.deleteAssociation(a.id))}>Supprimer</button>
      </div>
      {open && (
        <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 10, marginTop: 6 }}>
          <div className="row">
            <Field label="Modèle de relevé"><select className="planner-field" value={a.billingMode || ""} onChange={(e) => P.updateAssociation(a.id, { billingMode: e.target.value })}><option value="">Automatique</option>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Fréquence des relevés"><select className="planner-field" value={a.billingFreq || ""} onChange={(e) => P.updateAssociation(a.id, { billingFreq: e.target.value })}><option value="">Automatique ({String(FREQS[freqOf(a, P.stages.some((st) => st.associationId === a.id))]).split(" (")[0]})</option>{Object.entries(FREQS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Séries et vacances"><label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={!!a.skipVacations} onChange={(e) => P.updateAssociation(a.id, { skipVacations: e.target.checked })} />Pas de séance pendant les vacances (par défaut)</label></Field>
            <Field label="Prix fixe (copropriété, €)"><Num value={a.fixedPrice} w="100%" placeholder="ex. 375" onSave={(v) => P.updateAssociation(a.id, { fixedPrice: v })} /></Field>
            <Field label="E-mail"><input className="planner-field" defaultValue={a.email || ""} onBlur={(e) => e.target.value !== (a.email || "") && P.updateAssociation(a.id, { email: e.target.value.trim() })} /></Field>
            <Field label="Nom sur le document" help="Si le nom complet diffère du nom court (ex. UFCV ILE-DE-FRANCE)"><input className="planner-field" defaultValue={a.billingName || ""} placeholder={a.name} onBlur={(e) => e.target.value !== (a.billingName || "") && P.updateAssociation(a.id, { billingName: e.target.value.trim() })} /></Field>
          </div>
          <Field label="Adresse (apparaît sur le relevé)"><textarea className="planner-field" rows={3} defaultValue={a.address || ""} onBlur={(e) => e.target.value !== (a.address || "") && P.updateAssociation(a.id, { address: e.target.value })} /></Field>
          {known && (!a.address || !a.billingName) && (
            <button className="btn" style={{ marginBottom: 8 }} onClick={() => P.updateAssociation(a.id, { billingName: a.billingName || known.billingName, address: a.address || known.address })}>
              Utiliser les coordonnées connues de {known.billingName}
            </button>
          )}
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={!!a.billAdhesion} onChange={(e) => P.updateAssociation(a.id, { billAdhesion: e.target.checked })} /> Ajouter l'adhésion à ses relevés par défaut</label>
        </div>
      )}
    </div>
  );
}

function Assocs() {
  const P = usePlanner(); const [n, setN] = useState("");
  return (<div>
    <div className="row" style={{ marginBottom: 10 }}><input className="planner-field" placeholder="Nouvelle association" value={n} onChange={(e) => setN(e.target.value)} /><button className="btn" style={{ flex: "0 0 auto" }} onClick={() => { P.addAssociation(n); setN(""); }}>Ajouter</button><button className="btn" style={{ flex: "0 0 auto" }} onClick={P.copyPreviousYearAssociations}>Copier {yearLabel(P.year - 1)}</button></div>
    {P.associations.map((a) => <AssocRow key={a.id} a={a} />)}
  </div>);
}

function Closures() {
  const P = usePlanner(); const [f, setF] = useState({ label: "", startDate: "", endDate: "", roomId: "" });
  const add = () => { if (!f.label.trim() || !f.startDate) return P.notify("Motif et date de début requis", "error"); P.addClosure({ ...f, label: f.label.trim(), endDate: f.endDate || f.startDate, roomId: f.roomId || "" }); setF({ label: "", startDate: "", endDate: "", roomId: "" }); };
  return (<div>
    <div className="row" style={{ marginBottom: 10 }}>
      <input className="planner-field" placeholder="Motif (ex. Travaux)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      <DateInput value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} />
      <DateInput value={f.endDate} onChange={(v) => setF({ ...f, endDate: v })} />
      <select className="planner-field" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">Toutes les salles</option>{P.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <button className="btn" style={{ flex: "0 0 auto" }} onClick={add}>Ajouter</button></div>
    {P.closures.length === 0 && <p className="help">Aucune fermeture.</p>}
    {P.closures.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}><span><b>{c.label}</b> · {frShort(c.startDate)} → {frShort(c.endDate)} · {P.rooms.find((r) => r.id === c.roomId)?.name || "Toutes les salles"}</span><button className="link link-danger" onClick={() => P.deleteClosure(c.id)}>Supprimer</button></div>)}
  </div>);
}

function Backups() {
  const P = usePlanner();
  const [list, setList] = useState(null);
  React.useEffect(() => { if (canListBackups()) listBackups().then(setList).catch(() => setList([])); }, []);
  const restore = (b) => P.ask(`Restaurer la sauvegarde du ${frShort(b.day)} ? Les données actuelles seront remplacées (vous pourrez annuler avec « Annuler »).`, async () => {
    try { const txt = await readBackup(b.name); P.undoable("Sauvegarde restaurée", ["Room", "Association", "Booking", "RecurringBooking", "BookingTemplate", "Closure", "DayNote", "Invoice", "OrganisationSettings", "ActivityLog", "Stage", "Vacation"], () => P.importBackup(txt)); }
    catch (e) { P.notify("Restauration impossible : " + e.message, "error"); }
  });
  return (<div>
    <p className="help" style={{ marginBottom: 8 }}>Une copie automatique est faite chaque jour (30 jours conservés) dans le dossier de données.</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}><button className="btn" onClick={P.exportBackup}>Exporter une sauvegarde maintenant</button></div>
    {!canListBackups() ? <p className="help">La restauration automatique n'est disponible que dans le logiciel installé. Ici, utilisez « Importer » dans l'onglet Organisation.</p>
      : list === null ? <p className="help">Chargement…</p> : list.length === 0 ? <p className="help">Aucune sauvegarde pour le moment.</p>
      : list.map((b) => <div key={b.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}><span><b>{frShort(b.day)}</b> <span className="help">{Math.round(b.size / 1024)} ko</span></span><button className="link" onClick={() => restore(b)}>Restaurer</button></div>)}
  </div>);
}

const ENTITY_LABELS = { Booking: "réservation(s)", RecurringBooking: "série(s)", Stage: "stage(s)", Invoice: "relevé(s)", Association: "association(s)", DayNote: "note(s) de jour", Closure: "fermeture(s)", Vacation: "période(s) de vacances", ActivityLog: "ligne(s) d'historique" };

// Import d'un planning préparé à partir d'un tableur
export function ImportPlanning() {
  const P = usePlanner();
  const [prev, setPrev] = useState(null);
  const [data, setData] = useState(null);
  const [done, setDone] = useState(null);
  const pick = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let obj; try { obj = JSON.parse(String(r.result)); } catch (err) { P.notify("Fichier illisible", "error"); return; }
      if (!obj || obj.kind !== "import") { P.notify("Ce fichier n'est pas un planning à importer", "error"); return; }
      setData(obj); setPrev(P.importPreview(obj)); setDone(null);
    };
    r.readAsText(f);
  };
  const run = () => P.ask(`Ajouter ce planning à l'année ${yearLabel(prev.year)} ? Rien n'est remplacé : tout est ajouté, et vous pourrez annuler juste après.`, () => { const rep = P.importPlanning(data); setDone(rep); setPrev(null); setData(null); });
  return (<div>
    <p className="help" style={{ marginBottom: 10 }}>Ajoute d'un coup les séries, les réservations et les stages préparés dans un fichier (.json). Les associations manquantes sont créées dans l'année concernée. Rien n'est effacé : tout s'ajoute, et l'opération est annulable.</p>
    <label className="btn" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>Choisir un fichier de planning…<input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={pick} /></label>
    {prev && (<div className="checklist" style={{ marginTop: 12 }}>
      <div className="check check-info"><span>📄</span><span>{prev.source || "Fichier de planning"}</span></div>
      <div className="check check-ok"><span>✓</span><span><b>{prev.series}</b> séries hebdomadaires, <b>{prev.bookings}</b> réservations, <b>{prev.stages}</b> stages ({prev.stageDays} journées) pour l'année <b>{yearLabel(prev.year)}</b></span></div>
      <div className="check check-info"><span>+</span><span>{prev.newAssoc.length} association(s) à créer{prev.newAssoc.length ? " : " + prev.newAssoc.slice(0, 8).join(", ") + (prev.newAssoc.length > 8 ? "…" : "") : ""}</span></div>
      {prev.newRooms.length > 0 && <div className="check check-info"><span>+</span><span>Salle(s) à créer : {prev.newRooms.join(", ")}</span></div>}
      {prev.missRooms.length > 0 && <div className="check check-bad"><span>✕</span><span>Salles introuvables, ces lignes seront ignorées : {prev.missRooms.join(", ")}</span></div>}
      {prev.missFloors.length > 0 && <div className="check check-bad"><span>✕</span><span>Étages introuvables : {prev.missFloors.join(", ")}</span></div>}
      {prev.existing > 0 && <div className="check check-warn"><span>⚠</span><span>L'année contient déjà {prev.existing} élément(s) : l'import s'ajoute par-dessus, vérifiez les doublons après coup.</span></div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="btn btn-primary" onClick={run}>Ajouter au planning</button><button className="btn" onClick={() => { setPrev(null); setData(null); }}>Annuler</button></div>
    </div>)}
    {done && <div className="banner banner-green" style={{ marginTop: 12 }}>Import terminé : {done.series} séries, {done.bookings} réservations, {done.stages} stages, {done.assoc} associations et {done.rooms} salle(s) créées{done.skipped ? `, ${done.skipped} ligne(s) ignorée(s)` : ""}.</div>}
  </div>);
}

// Supprimer d'un coup les réservations d'une association sur une période
export function Purge() {
  const P = usePlanner();
  const b = yearBounds(P.year);
  const [assocId, setAssoc] = useState("");
  const [from, setFrom] = useState(b.start);
  const [to, setTo] = useState(b.end);
  const [what, setWhat] = useState({ series: true, bookings: true, stages: true });
  const [done, setDone] = useState(null);
  const opts = { assocId, from, to, ...what };
  const pv = useMemo(() => (assocId && from <= to ? P.purgePreview(opts) : null), [assocId, from, to, what.series, what.bookings, what.stages, P.db.Booking, P.db.RecurringBooking, P.db.Stage]);
  const assoc = P.associations.find((a) => a.id === assocId);
  const run = () => P.ask(`Supprimer ${pv.total} séance(s) de « ${assoc.name} » entre le ${frShort(from)} et le ${frShort(to)} ? Vous pourrez annuler juste après.`, () => { const r = P.purge(opts); setDone(r.total); });
  return (<div>
    <p className="help" style={{ marginBottom: 10 }}>Pour faire le ménage quand une association s'arrête ou change de créneau. Les séries entièrement comprises dans la période sont supprimées ; celles qui débordent sont conservées, seules leurs séances de la période sont retirées. L'opération est annulable.</p>
    <div className="row">
      <Field label="Association"><select className="planner-field" value={assocId} onChange={(e) => { setAssoc(e.target.value); setDone(null); }}><option value="">— Choisir —</option>{P.associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field label="Du"><DateInput value={from} onChange={setFrom} /></Field>
      <Field label="Au"><DateInput value={to} min={from} onChange={setTo} /></Field>
    </div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "4px 0 10px" }}>
      {[["series", "Séries hebdomadaires"], ["bookings", "Réservations ponctuelles"], ["stages", "Stages"]].map(([k, lbl]) => (
        <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={what[k]} onChange={(e) => { setWhat((x) => ({ ...x, [k]: e.target.checked })); setDone(null); }} />{lbl}</label>
      ))}
    </div>
    {pv && (pv.total === 0 ? <p className="help">Rien à supprimer pour cette association sur cette période.</p> : (
      <div className="checklist">
        <div className="check check-warn"><span>⚠</span><span><b>{pv.total} séance(s)</b> seraient supprimées.</span></div>
        {pv.series.length > 0 && <div className="check check-info"><span>↻</span><span>{pv.series.filter((x) => x.whole).length} série(s) supprimée(s) entièrement, {pv.series.filter((x) => !x.whole).length} série(s) seulement allégée(s) sur la période</span></div>}
        {pv.bookings.length > 0 && <div className="check check-info"><span>•</span><span>{pv.bookings.length} réservation(s) ponctuelle(s)</span></div>}
        {pv.stages.length > 0 && <div className="check check-info"><span>•</span><span>{pv.stages.length} stage(s), avec toutes leurs journées</span></div>}
        <div><button className="btn btn-danger" onClick={run}>Supprimer ces {pv.total} séances</button></div>
      </div>
    ))}
    {done !== null && <div className="banner banner-green" style={{ marginTop: 10 }}>{done} séance(s) supprimée(s). Le bouton « Annuler » en bas de l'écran permet de revenir en arrière.</div>}
  </div>);
}

export function Archives() {
  const P = usePlanner();
  const [list, setList] = useState(null);
  const reload = () => { if (canArchiveYears()) listArchives().then(setList).catch(() => setList([])); else setList([]); };
  React.useEffect(reload, []);
  const doArchive = (g) => P.ask(`Archiver l'année ${yearLabel(g.year)} ? Ses ${g.total} élément(s) seront enregistrés dans le dossier « archives », puis retirés du planning. Vous pourrez les réintégrer à tout moment.`, async () => { await P.archiveYear(g.year); reload(); });
  const restore = (a) => P.ask(`Réintégrer l'année ${yearLabel(a.year)} dans le planning ? Le fichier d'archive est conservé.`, async () => {
    try { P.restoreArchive(await readArchive(a.name)); } catch (e) { P.notify("Lecture impossible : " + e.message, "error"); }
  });
  const pickFile = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => P.restoreArchive(String(r.result)); r.readAsText(f); e.target.value = ""; };
  return (<div>
    <p className="help" style={{ marginBottom: 10 }}>Le planning garde l'année en cours et les {P.keepYears - 1} précédentes. Les années plus anciennes peuvent être archivées : elles sont enregistrées dans un fichier par année, dans le dossier « archives » à côté de vos données, puis retirées du planning pour qu'il reste rapide. Rien n'est perdu : une archive se réintègre en un clic.</p>
    <h4 style={{ margin: "0 0 6px" }}>Années à archiver</h4>
    {P.archivable.length === 0 ? <p className="help">Aucune année ancienne pour le moment. ✓</p> : P.archivable.map((g) => (
      <div key={g.year} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #F0E9D9", flexWrap: "wrap" }}>
        <span><b>{yearLabel(g.year)}</b> · <span className="help">{Object.entries(g.counts).filter(([k]) => ENTITY_LABELS[k]).map(([k, n]) => `${n} ${ENTITY_LABELS[k]}`).join(", ")}</span></span>
        <button className="btn" onClick={() => doArchive(g)}>Archiver {yearLabel(g.year)}</button>
      </div>
    ))}
    <h4 style={{ margin: "16px 0 6px" }}>Archives existantes</h4>
    {!canArchiveYears() ? <p className="help">Dans le logiciel installé, les archives sont rangées automatiquement. Ici, l'archivage télécharge un fichier que vous pouvez réimporter ci-dessous.</p>
      : list === null ? <p className="help">Chargement…</p> : list.length === 0 ? <p className="help">Aucune archive pour le moment.</p>
      : list.map((a) => <div key={a.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}><span><b>{yearLabel(a.year)}</b> <span className="help">{Math.max(1, Math.round(a.size / 1024))} ko</span></span><button className="link" onClick={() => restore(a)}>Réintégrer</button></div>)}
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      {canArchiveYears() && <button className="btn" onClick={() => openArchives()}>Ouvrir le dossier « archives »</button>}
      <label className="btn" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>Réintégrer un fichier d'archive…<input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={pickFile} /></label>
    </div>
  </div>);
}

function Series() {
  const P = usePlanner();
  const nm = (s) => P.assocOf(s)?.name || s.customName || "Série";
  const nextY = P.year + 1;
  return (<div>{P.recurring.length > 0 && <p className="help" style={{ marginBottom: 8 }}>Pour reconduire ces séries l'année prochaine, ouvrez Planning › Semaine type › « Préparer la rentrée {yearLabel(nextY)} ».</p>}{P.recurring.length === 0 && <p className="help">Aucune série cette année.</p>}
    {P.recurring.map((s) => <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #F0E9D9", flexWrap: "wrap" }}>
      <span><b>{nm(s)}</b> · {FREQUENCY_LABELS[s.frequency]}{s.frequency === "weekly" ? ` (${(s.days && s.days.length ? s.days : [s.weekday]).map((d) => WEEKDAYS[d]).join(", ")})` : ""} · {s.start}–{s.end} · {P.rooms.find((r) => r.id === s.roomId)?.name}<br /><span className="help">{frShort(s.startDate)} → {frShort(s.endDate)} · {(s.exceptions || []).length} séance(s) annulée(s)</span></span>
      <span><button className="link" onClick={() => P.updateRecurringFields(s.id, { status: "confirme" })}>Valider</button><button className="link" onClick={() => P.updateRecurringFields(s.id, { paymentStatus: "paid" })}>Payé</button><button className="link link-danger" onClick={() => P.ask("Supprimer cette série ?", () => P.deleteRecurring(s.id))}>Supprimer</button></span></div>)}</div>);
}

function Vacations() {
  const P = usePlanner(); const [f, setF] = useState({ label: "", startDate: "", endDate: "" });
  const add = () => { if (!f.label.trim() || !f.startDate) return P.notify("Nom et date de début requis", "error"); const end = f.endDate || f.startDate; if (end < f.startDate) return P.notify("La date de fin précède le début", "error"); P.addVacation({ label: f.label.trim(), startDate: f.startDate, endDate: end }); setF({ label: "", startDate: "", endDate: "" }); };
  return (<div>
    <div style={{ marginBottom: 8 }}><button className="btn" onClick={P.addOfficialHolidays}>Ajouter les vacances officielles (zone C – Paris, 2026 à 2028)</button></div>
    <p className="help" style={{ marginBottom: 8 }}>Les jours de vacances scolaires apparaissent en rose dans le planning (sans bloquer les réservations). Dernier jour inclus.</p>
    <div className="row" style={{ marginBottom: 10 }}>
      <input className="planner-field" placeholder="Ex. Vacances de la Toussaint" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      <DateInput value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} />
      <DateInput value={f.endDate} onChange={(v) => setF({ ...f, endDate: v })} />
      <button className="btn" style={{ flex: "0 0 auto" }} onClick={add}>Ajouter</button></div>
    {P.vacations.length === 0 && <p className="help">Aucune période de vacances pour {yearLabel(P.year)}.</p>}
    {P.vacations.map((v) => <div key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E9D9", background: "#FBE4EC66" }}><span><b>{v.label}</b> · {frShort(v.startDate)} → {frShort(v.endDate)}</span><button className="link link-danger" onClick={() => P.deleteVacation(v.id)}>Supprimer</button></div>)}
  </div>);
}

function Stages() {
  const P = usePlanner();
  const [edit, setEdit] = useState(null);
  const saveFloors = (floors) => P.updateOrg({ floors, floorsFixed: true });
  const setFloor = (i, patch) => saveFloors(P.floors.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (<div>
    <h3 className="serif" style={{ marginBottom: 6 }}>Étages et prix des stages BAFA</h3>
    <p className="help" style={{ marginBottom: 8 }}>Un stage réserve toutes les salles de l'étage, de 9h à 18h. Le prix est facturé <b>par jour</b> (et non par salle ni par heure).</p>
    {P.floors.map((fl, i) => { const ids = P.floorRoomIds(fl); return (
      <div key={fl.name} className="card" style={{ padding: 10, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ minWidth: 110 }}>{fl.name}</b>
          <span className="help">Prix / jour (€)</span><Num value={fl.price} w={90} onSave={(v) => setFloor(i, { price: v ?? 0 })} /><span className="help">Nom sur le relevé</span><input className="planner-field" style={{ width: 150 }} defaultValue={fl.statementLabel || fl.name} onBlur={(e) => e.target.value !== (fl.statementLabel || fl.name) && setFloor(i, { statementLabel: e.target.value.trim() })} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>{P.rooms.map((r) => <label key={r.id} style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, padding: "3px 7px", background: ids.includes(r.id) ? "var(--primary-soft)" : "#fff" }}><input type="checkbox" checked={ids.includes(r.id)} onChange={(e) => setFloor(i, { roomIds: e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id) })} /> {r.name}</label>)}</div>
      </div>); })}
    <h3 className="serif" style={{ margin: "14px 0 6px" }}>Stages de {yearLabel(P.year)}</h3>
    {P.stages.length === 0 && <p className="help">Aucun stage. Créez-en un avec « + Stage BAFA » dans le Planning.</p>}
    {edit && <StageModal stage={edit} onClose={() => setEdit(null)} />}
    {P.stages.map((s) => <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #F0E9D9", flexWrap: "wrap" }}>
      <span><b>{s.label}</b> · {s.floorName} · {P.associations.find((a) => a.id === s.associationId)?.name || s.customName}<br /><span className="help">{s.dates.length} jour(s) : {frShort(s.dates[0])} → {frShort(s.dates[s.dates.length - 1])} · {s.start}–{s.end}</span></span>
      <span><button className="link" onClick={() => setEdit(s)}>Modifier</button><button className="link" onClick={() => P.updateStageStatus(s.id, { status: "confirme" })}>Valider</button><button className="link" onClick={() => P.updateStageStatus(s.id, { paymentStatus: "paid" })}>Payé</button><button className="link link-danger" onClick={() => P.ask("Supprimer ce stage (tous les jours et toutes les salles) ?", () => P.deleteStage(s.id))}>Supprimer</button></span></div>)}
  </div>);
}

function Templates() {
  const P = usePlanner();
  const have = new Set(P.templates.map((t) => t.name));
  const missing = SEED_TEMPLATES.filter((t) => !have.has(t.name));
  return (<div>{P.templates.length === 0 && <p className="help">Aucun modèle. Enregistrez-en un depuis le formulaire de réservation.</p>}
    {P.templates.map((t) => <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}><span><b>{t.name}</b> · {t.start}–{t.end} · {P.rooms.find((r) => r.id === t.roomId)?.name || <span className="help">salle au choix</span>}</span><button className="link link-danger" onClick={() => P.deleteTemplate(t.id)}>Supprimer</button></div>)}
    {missing.length > 0 && <button className="btn" style={{ marginTop: 10 }} onClick={() => P.undoable(`${missing.length} modèle(s) courant(s) ajouté(s)`, ["BookingTemplate"], () => missing.forEach((t) => P.saveTemplate(t)))}>Ajouter les modèles courants ({missing.map((t) => t.name.split(" · ")[0]).join(", ")})</button>}</div>);
}

function Team() {
  const P = usePlanner(); const [name, setName] = useState("");
  const team = P.org.staff || [];
  const add = () => { const n = name.trim(); if (!n || team.includes(n)) { setName(""); return; } P.updateOrg({ staff: [...team, n] }); setName(""); };
  return (<div>
    <p className="help" style={{ marginBottom: 8 }}>Les personnes qui ouvrent, ferment ou s'absentent. Elles apparaissent en boutons dans « Note du jour », sans lien avec les profils Katell / Pierre du logiciel.</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}><input className="planner-field" placeholder="Prénom ou nom" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /><button className="btn btn-primary" onClick={add}>Ajouter</button></div>
    {team.length === 0 && <p className="help">Aucune personne pour le moment.</p>}
    {team.map((n) => <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E9D9" }}><span>{n}</span><button className="link" onClick={() => P.updateOrg({ staff: team.filter((x) => x !== n) })}>Retirer</button></div>)}
  </div>);
}

// Publier l'affichage sur le réseau local : la télévision ouvre l'adresse, ou
// Chrome l'ouvre et la caste sur le Chromecast.
function ReseauAffichage() {
  const P = usePlanner();
  const fs = typeof window !== "undefined" ? window.salleplanFS : null;
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => { if (fs && fs.netStatus) fs.netStatus().then(setSt).catch(() => {}); };
  useEffect(() => { refresh(); }, []);
  if (!fs || !fs.netStart) return <p className="help" style={{ marginTop: 6 }}>La publication sur le réseau n'existe que dans le logiciel installé.</p>;
  const toggle = async () => {
    setBusy(true);
    const r = st && st.on ? await fs.netStop() : await fs.netStart();
    setBusy(false);
    if (r && r.ok === false) P.notify(r.error || "Publication impossible", "error");
    refresh();
  };
  return (
    <div style={{ marginTop: 6 }}>
      <label className="lbl">Publier l'affichage sur le réseau local</label>
      <p className="help" style={{ marginBottom: 6 }}>La télévision ouvre l'adresse dans son navigateur, ou un ordinateur l'ouvre dans Chrome et la caste sur le Chromecast. La page ne contient que l'horaire du jour : ni note interne, ni contact, ni montant. Windows demandera une fois l'autorisation pour le réseau privé.</p>
      <button className="btn" disabled={busy} onClick={toggle}>{st && st.on ? "Arrêter la publication" : "Publier sur le réseau"}</button>
      {st && st.on && (
        <div style={{ marginTop: 8 }}>
          {(st.urls || []).map((u) => <div key={u}><code style={{ fontSize: 15 }}>{u}</code> <button className="link" onClick={() => navigator.clipboard && navigator.clipboard.writeText(u)}>Copier</button></div>)}
          {!(st.urls || []).length && <p className="help">Aucune adresse réseau trouvée : l'ordinateur n'est relié à aucun réseau.</p>}
          <p className="help" style={{ marginTop: 4 }}>Laissez le logiciel ouvert : c'est lui qui alimente la page.</p>
        </div>
      )}
    </div>
  );
}

function Org() {
  const P = usePlanner(); const o = P.org; const file = useRef();
  const [f, setF] = useState({ name: o.name, subtitle: o.subtitle, address: o.address, phone: o.phone, email: o.email, website: o.website, siret: o.siret, signatory: o.signatory, adhesionLabel: o.adhesionLabel, adhesionAmount: String(o.adhesionAmount ?? ""), fixedPrices: (o.fixedPrices || []).join(", "), legal: o.legal || "", invoicePrefix: o.invoicePrefix || "REL", nextInvoiceNumber: o.nextInvoiceNumber || 1 });
  const ribRef = useRef(); const signRef = useRef();
  const pickImage = (key) => (e) => {
    const fl = e.target.files[0]; if (!fl) return; e.target.value = "";
    const img = new Image(); const url = URL.createObjectURL(fl);
    img.onload = () => {
      const k = Math.min(1, 1000 / img.width); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); P.updateOrg({ [key]: c.toDataURL("image/jpeg", 0.85) });
    };
    img.onerror = () => P.notify("Image illisible", "error"); img.src = url;
  };
  const save = () => P.updateOrg({ ...f, adhesionAmount: Number(String(f.adhesionAmount).replace(",", ".")) || 0, fixedPrices: f.fixedPrices.split(/[;,]/).map((x) => Number(x.trim().replace(",", "."))).filter((x) => x > 0), nextInvoiceNumber: Number(f.nextInvoiceNumber) || 1 });
  const T = (k, label, extra) => <Field label={label}><input className="planner-field" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></Field>;
  const onFile = (e) => { const fl = e.target.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => { const txt = String(r.result); try { JSON.parse(txt); } catch (err) { P.notify("Fichier de sauvegarde invalide", "error"); return; } P.ask("Remplacer toutes les données actuelles par cette sauvegarde ?", () => { try { P.importBackup(txt); } catch (err) { P.notify("Fichier de sauvegarde invalide", "error"); } }); }; r.readAsText(fl); e.target.value = ""; };
  return (<div>
    <h3 className="serif" style={{ marginBottom: 6 }}>En-tête des relevés de frais</h3>
    <div className="row">{T("name", "Nom de l'association")}{T("subtitle", "Sous-titre")}</div>
    <Field label="Adresse"><textarea className="planner-field" rows={3} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
    <div className="row">{T("phone", "Téléphone")}{T("email", "E-mail")}{T("website", "Site")}{T("siret", "SIRET")}</div>
    <div className="row">{T("signatory", "Nom du signataire")}{T("adhesionLabel", "Libellé de l'adhésion")}{T("adhesionAmount", "Adhésion (€)")}{T("fixedPrices", "Prix fixes copropriétés (€)", { placeholder: "375, 480" })}</div>
    <div className="row" style={{ marginBottom: 10 }}>
      <div><label className="lbl">RIB (image affichée en bas des relevés)</label>{o.ribImage && <img src={o.ribImage} alt="" style={{ maxWidth: "100%", maxHeight: 90, display: "block", marginBottom: 4, border: "1px solid var(--border)" }} />}<button className="btn" onClick={() => ribRef.current.click()}>{o.ribImage ? "Remplacer" : "Choisir l'image"}</button>{o.ribImage && <button className="link link-danger" onClick={() => P.updateOrg({ ribImage: "" })}>Retirer</button>}<input ref={ribRef} type="file" accept="image/*" hidden onChange={pickImage("ribImage")} /></div>
      <div><label className="lbl">Signature / cachet</label>{o.signImage && <img src={o.signImage} alt="" style={{ maxWidth: "100%", maxHeight: 90, display: "block", marginBottom: 4, border: "1px solid var(--border)" }} />}<button className="btn" onClick={() => signRef.current.click()}>{o.signImage ? "Remplacer" : "Choisir l'image"}</button>{o.signImage && <button className="link link-danger" onClick={() => P.updateOrg({ signImage: "" })}>Retirer</button>}<input ref={signRef} type="file" accept="image/*" hidden onChange={pickImage("signImage")} /></div>
    </div>
    <Field label="Mentions en pied de page (facultatif)"><textarea className="planner-field" rows={2} value={f.legal} onChange={(e) => setF({ ...f, legal: e.target.value })} /></Field>
    <div className="row"><Field label="Préfixe de la référence"><input className="planner-field" value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value })} /></Field><Field label="Prochain numéro"><NumInput value={f.nextInvoiceNumber} onChange={(v) => setF({ ...f, nextInvoiceNumber: v })} /></Field></div>
    <button className="btn btn-primary" onClick={save}>Enregistrer</button>
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }}>
      <h3 className="serif" style={{ marginBottom: 6 }}>Écran d'affichage du hall</h3>
      <Field label="Titre affiché sur l'écran" help="Le nom que le public lit dans le hall. Les relevés de frais gardent le nom de l'association.">
        <input className="planner-field" style={{ maxWidth: 360 }} defaultValue={o.displayTitle || ""} placeholder={o.name} onBlur={(e) => e.target.value !== (o.displayTitle || "") && P.updateOrg({ displayTitle: e.target.value })} />
      </Field>
      <label className="help" style={{ display: "flex", gap: 6, alignItems: "center", margin: "2px 0 6px" }}>
        <input type="checkbox" checked={o.displayNightFrom !== "off"} onChange={(e) => P.updateOrg({ displayNightFrom: e.target.checked ? "23:00" : "off" })} />
        Éteindre l'écran la nuit
      </label>
      {o.displayNightFrom !== "off" && (
        <div className="row">
          <Field label="Écran éteint à partir de" help="Il reste noir jusqu'à l'heure de reprise."><TimeInput value={o.displayNightFrom || ""} onChange={(v) => P.updateOrg({ displayNightFrom: v })} /></Field>
          <Field label="et rallumé à"><TimeInput value={o.displayNightTo || ""} onChange={(v) => P.updateOrg({ displayNightTo: v })} /></Field>
        </div>
      )}
      <Field label="Fond de l'écran" help="Chaque activité porte la couleur de son association ; elle se règle dans Réglages › Associations.">
        <select className="planner-field" style={{ maxWidth: 260 }} value={o.displayTheme === "dark" ? "dark" : "light"} onChange={(e) => P.updateOrg({ displayTheme: e.target.value })}>
          <option value="light">Fond blanc (couleurs vives)</option>
          <option value="dark">Fond sombre</option>
        </select>
      </Field>
      <ReseauAffichage />
    </div>
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }}>
      <h3 className="serif" style={{ marginBottom: 6 }}>Données partagées entre ordinateurs</h3>
      {!P.sync.enabled ? <p className="help" style={{ marginBottom: 8 }}>Disponible dans l'application Windows installée : les données sont alors enregistrées dans un fichier que vous pouvez placer dans un dossier OneDrive, Google Drive ou Dropbox pour que Katell et vous voyiez les mêmes informations.</p> : (
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 13 }}>{P.sync.shared ? "Dossier partagé actuel :" : "Dossier actuel (cet ordinateur uniquement) :"} <b style={{ wordBreak: "break-all" }}>{P.sync.dir}</b></p>
          <p className="help" style={{ margin: "4px 0 8px" }}>Une copie datée est faite chaque jour dans le sous-dossier « sauvegardes » (30 jours conservés). Ne travaillez pas à deux sur exactement la même fiche en même temps : si l'autre poste modifie les données, l'application recharge automatiquement, ou vous propose de choisir.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={async () => { const r = await P.chooseFolder(); if (r.canceled) return; if (r.exists) P.ask(`Ce dossier contient déjà des données${r.savedBy ? ` (dernière modification par ${r.savedBy})` : ""}. Les utiliser à la place de celles de cet ordinateur ? (« Annuler » = rester sur le dossier précédent)`, () => P.adoptFolder(true), () => P.revertFolder(r.prevDir)); else P.adoptFolder(false); }}>Choisir un dossier partagé…</button>
            <button className="btn" onClick={P.openFolder}>Ouvrir le dossier</button>
            {P.sync.shared && <button className="btn" onClick={() => P.ask("Revenir au dossier de cet ordinateur ? Vos données partagées ne seront plus utilisées ici.", () => P.useLocalFolder())}>Revenir au dossier local</button>}
          </div>
        </div>)}
      <h3 className="serif" style={{ marginBottom: 6, marginTop: 14 }}>Sauvegarde manuelle</h3>
      <p className="help" style={{ marginBottom: 8 }}>Les données sont enregistrées sur cet ordinateur. Exportez régulièrement une sauvegarde JSON ; importez-la sur un autre poste pour y retrouver les mêmes données.</p>
      <div style={{ display: "flex", gap: 8 }}><button className="btn" onClick={P.exportBackup}>Exporter la sauvegarde</button><button className="btn" onClick={() => file.current.click()}>Importer une sauvegarde</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} /></div>
    </div></div>);
}

export default function SettingsModal({ onClose, initialTab }) {
  const [tab, setTab] = useState(initialTab || "rooms");
  const tabs = [["rooms", "Salles", Rooms], ["assoc", "Associations", Assocs], ["closures", "Fermetures", Closures], ["vac", "Vacances", Vacations], ["stages", "Stages", Stages], ["series", "Récurrences", Series], ["tpl", "Modèles", Templates], ["team", "Équipe", Team], ["bak", "Sauvegardes", Backups], ["arch", "Archives", Archives], ["imp", "Import", ImportPlanning], ["purge", "Nettoyage", Purge], ["org", "Organisation", Org]];
  const Cur = tabs.find((t) => t[0] === tab)[2];
  return (
    <Modal title="Réglages" onClose={onClose} width={860}>
      <div className="seg" style={{ marginBottom: 12, flexWrap: "wrap" }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      <Cur />
    </Modal>
  );
}
