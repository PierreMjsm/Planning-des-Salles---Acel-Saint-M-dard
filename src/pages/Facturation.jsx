import React, { useEffect, useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { Modal, Field, NumInput, DateInput } from "../components/ui.jsx";
import { PrintLayer } from "../components/DailySheet.jsx";
import StatementView from "../components/StatementView.jsx";
import { buildStatement, KINDS } from "../lib/planner/statements.js";
import { round2 } from "../lib/planner/occurrences.js";
import { yearBounds, todayKey, frShort } from "../lib/planner/dates.js";
import { fmtMoney } from "../lib/planner/format.js";
import { PAYMENT_METHODS } from "../lib/planner/constants.js";
import { download, invoicesCsv } from "../lib/planner/exports.js";
import { canArchive, archivePdf, revealFile, getArchiveDir, chooseArchiveDir, openArchiveDir } from "../lib/planner/sync.js";

const safeName = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
import { addMonths, monthBounds } from "../lib/planner/dates.js";

function PaymentModal({ inv, onClose }) {
  const P = usePlanner();
  const rest = round2(inv.total - inv.amountPaid);
  const [amount, setAmount] = useState(String(rest));
  const [method, setMethod] = useState("virement");
  const [date, setDate] = useState(todayKey());
  const [ref, setRef] = useState("");
  const submit = () => { const a = Number(String(amount).replace(",", ".")); if (!(a > 0)) return P.notify("Montant invalide", "error"); P.addInvoicePayment(inv.id, { amount: a, method, date, reference: ref }); onClose(); if (a >= rest - 0.005) setTimeout(() => P.ask("Le relevé est entièrement réglé. Marquer aussi les séances de la période comme payées ?", () => P.markPeriodPaid(inv)), 50); };
  return (
    <Modal title={`Règlement · ${inv.number}`} subtitle={`Reste dû : ${fmtMoney(rest)}`} onClose={onClose} width={460}>
      <Field label="Montant (€)"><NumInput decimal value={amount} onChange={setAmount} /></Field>
      <Field label="Mode de paiement"><select className="planner-field" value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
      <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
      <Field label="Référence"><input className="planner-field" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={submit}>Enregistrer le règlement</button></div>
    </Modal>
  );
}

const mailTo = (to, subject, body) => { window.location.href = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };

function BatchModal({ onClose, onDone }) {
  const P = usePlanner();
  const prev = monthBounds(addMonths(todayKey(), -1));
  const [from, setFrom] = useState(prev.start);
  const [to, setTo] = useState(prev.end);
  const [issued, setIssued] = useState(todayKey());
  const [sel, setSel] = useState({});
  const cands = useMemo(() => {
    const sessions = P.allSessions(from, to);
    const out = [];
    for (const a of P.associations) {
      const kinds = a.billingMode ? [a.billingMode] : ["hourly", "stage"];
      for (const kind of kinds) {
        const hadAdhesion = P.invoices.some((i) => i.associationId === a.id && i.extras && i.extras.length);
        const st = buildStatement({ kind, assoc: a, sessions, rooms: P.rooms, stages: P.db.Stage, floors: P.floors, from, to, fixedPrice: a.fixedPrice || (P.org.fixedPrices || [])[0] || 0, withAdhesion: kind === "hourly" && !!a.billAdhesion && !hadAdhesion, org: P.org, issuedAt: issued });
        if (!st.rows.length) continue;
        const dup = P.invoices.some((i) => i.associationId === a.id && i.kind === kind && i.periodStart === from && i.periodEnd === to);
        out.push({ key: a.id + kind, st, dup });
      }
    }
    return out;
  }, [from, to, issued, P.allSessions, P.associations, P.invoices, P.db.Stage]);
  React.useEffect(() => { setSel(Object.fromEntries(cands.filter((c) => !c.dup).map((c) => [c.key, true]))); }, [cands.length, from, to]);
  const chosen = cands.filter((c) => sel[c.key]);
  const go = () => { const recs = P.saveInvoicesBatch(chosen.map((c) => ({ ...c.st, issuedAt: issued }))); onDone(recs); };
  return (
    <Modal title="Générer les relevés de la période" subtitle="Un relevé par association ayant des séances validées" onClose={onClose} width={680}>
      <div className="row"><Field label="Du"><DateInput value={from} onChange={setFrom} /></Field><Field label="Au"><DateInput value={to} onChange={setTo} /></Field><Field label="Date des relevés"><DateInput value={issued} onChange={setIssued} /></Field></div>
      {cands.length === 0 ? <p className="help">Aucune association n'a de séance validée et facturable sur cette période.</p> : (
        <table className="table"><tbody>{cands.map((c) => <tr key={c.key}><td style={{ width: 28 }}><input type="checkbox" checked={!!sel[c.key]} onChange={(e) => setSel({ ...sel, [c.key]: e.target.checked })} /></td><td><b>{c.st.associationName}</b><br /><span className="help">{KINDS[c.st.kind].split(" (")[0]} · {c.st.rows.length} ligne(s){c.dup ? " · déjà créé pour cette période" : ""}</span></td><td style={{ textAlign: "right" }}><b>{fmtMoney(c.st.total)}</b></td></tr>)}</tbody></table>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span className="help">{chosen.length} relevé(s) · {fmtMoney(chosen.reduce((t, c) => t + c.st.total, 0))}</span>
        <span><button className="btn" onClick={onClose}>Annuler</button> <button className="btn btn-primary" disabled={!chosen.length} onClick={go}>Créer et imprimer</button></span>
      </div>
    </Modal>
  );
}

export default function Facturation() {
  const P = usePlanner();
  const b = yearBounds(P.year);
  const [assocId, setAssoc] = useState("");
  const [kind, setKind] = useState("hourly");
  const [from, setFrom] = useState(b.start);
  const [to, setTo] = useState(b.end);
  const [issued, setIssued] = useState(todayKey());
  const [adhesion, setAdhesion] = useState(false);
  const [fixed, setFixed] = useState("");
  const [print, setPrint] = useState(null);
  const [archDir, setArchDir] = useState("");
  useEffect(() => { getArchiveDir().then(setArchDir).catch(() => {}); }, []);
  const [pay, setPay] = useState(null);
  const [filter, setFilter] = useState("all");
  const [batch, setBatch] = useState(false);
  const [batchPrint, setBatchPrint] = useState(null);
  const assoc = P.associations.find((x) => x.id === assocId);

  useEffect(() => { setFrom(b.start); setTo(b.end); setAssoc(""); }, [P.year]);
  useEffect(() => {
    if (!assoc) return;
    const hasStage = P.stages.some((s) => s.associationId === assoc.id);
    setKind(assoc.billingMode || (hasStage ? "stage" : "hourly"));
    setAdhesion(!!assoc.billAdhesion && !P.invoices.some((i) => i.associationId === assoc.id && i.extras && i.extras.length));
    setFixed(String(assoc.fixedPrice || (P.org.fixedPrices && P.org.fixedPrices[0]) || ""));
  }, [assocId]);

  const st = useMemo(() => {
    if (!assoc) return null;
    return buildStatement({ kind, assoc, sessions: P.allSessions(from, to), rooms: P.rooms, stages: P.db.Stage, floors: P.floors, from, to, fixedPrice: Number(String(fixed).replace(",", ".")) || 0, withAdhesion: adhesion, org: P.org, issuedAt: issued });
  }, [assoc, kind, from, to, fixed, adhesion, issued, P.allSessions, P.rooms, P.db.Stage, P.floors, P.org]);
  const empty = st && st.rows.length === 0;
  const create = () => { const rec = P.saveInvoice(st); setPrint({ ...rec }); };
  const status = (i) => (i.amountPaid >= i.total ? "Payé" : i.amountPaid > 0 ? "Partiellement payé" : "À régler");
  const mail = (i, relance, withFile) => {
    const a = P.associations.find((x) => x.id === i.associationId);
    const rest = fmtMoney(round2(i.total - i.amountPaid));
    const period = `du ${frShort(i.periodStart)} au ${frShort(i.periodEnd)}`;
    const sign = `\n\nCordialement,\n${P.org.signatory}\n${P.org.name}`;
    if (relance) P.patchInvoice(i.id, { lastReminderAt: new Date().toISOString(), reminders: (i.reminders || 0) + 1 });
    if (relance) mailTo((a && a.email) || i.email, `Relance – relevé de frais ${i.number}`, `Bonjour,\n\nSauf erreur de notre part, le relevé de frais ${i.number} (${period}) d'un montant restant dû de ${rest} n'a pas encore été réglé.\n\nMerci de nous adresser votre règlement.${sign}`);
    else mailTo((a && a.email) || i.email, `Relevé de frais ${i.number} – ${P.org.name}`, `Bonjour,\n\nVeuillez trouver ci-joint le relevé de frais (${period}) d'un montant de ${fmtMoney(i.total)}.${sign}`);
  };
  // Archive le PDF dans le dossier d'archivage (sans boîte de dialogue) et garde la trace dans le relevé
  const archive = async (i, quiet) => {
    if (!canArchive()) { P.notify("L'enregistrement PDF automatique n'est disponible que dans le logiciel installé", "error"); return null; }
    const r = await archivePdf(`${i.number}_${safeName(i.associationName)}`, (i.issuedAt || todayKey()).slice(0, 4));
    if (!r || !r.ok) { P.notify("PDF non enregistré : " + ((r && r.error) || "erreur"), "error"); return null; }
    P.patchInvoice(i.id, { archivedPath: r.path, archivedAt: new Date().toISOString() });
    if (!quiet) P.notify("PDF archivé : " + r.path);
    return r.path;
  };
  // Archive le PDF, affiche le fichier dans son dossier (pour le joindre) et ouvre le message pré-rempli
  const send = async (i) => {
    let file = i.archivedPath;
    if (canArchive()) { file = (await archive(i, true)) || file; if (file) await revealFile(file); }
    P.patchInvoice(i.id, { sentAt: new Date().toISOString() });
    mail(i, false, !!file);
  };
  useEffect(() => {
    if (!print || !print.__auto) return;
    const t = setTimeout(async () => { const { __auto, ...inv } = print; if (__auto === "pdf") await archive(inv); else await send(inv); setPrint(null); }, 450);
    return () => clearTimeout(t);
  }, [print]);
  const chooseDir = async () => { const r = await chooseArchiveDir(); if (r && r.ok) setArchDir(r.dir); };
  const rows = P.invoices.filter((i) => filter === "all" || (filter === "unpaid" ? i.amountPaid < i.total : i.amountPaid >= i.total)).sort((a, c) => (filter === "unpaid" ? (a.dueDate || "") < (c.dueDate || "") ? -1 : 1 : 0));
  // contrôle de la numérotation : doublons et numéros manquants
  const numCheck = (() => {
    const nums = P.invoices.map((i) => (String(i.number).match(/-(\d+)$/) || [])[1]).filter(Boolean).map(Number).sort((a, c) => a - c);
    const dup = nums.filter((n, k) => k && n === nums[k - 1]);
    const gaps = []; for (let k = 1; k < nums.length; k++) for (let n = nums[k - 1] + 1; n < nums[k]; n++) gaps.push(n);
    return { dup: [...new Set(dup)], gaps };
  })();
  const paymentsCsv = () => { const rowsP = [["Date", "Numero", "Association", "Mode", "Montant", "Note"]]; P.invoices.forEach((i) => (i.payments || []).forEach((p) => rowsP.push([p.date, i.number, i.associationName, p.method, String(p.amount).replace(".", ","), p.note || ""]))); return rowsP.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n"); };
  const totalBilled = P.invoices.reduce((s, i) => s + i.total, 0), totalPaid = P.invoices.reduce((s, i) => s + i.amountPaid, 0);
  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="serif" style={{ marginBottom: 8 }}>Nouveau relevé de frais</h2>
        <div className="row">
          <Field label="Association / copropriété"><select className="planner-field" value={assocId} onChange={(e) => setAssoc(e.target.value)}><option value="">— Choisir —</option>{P.associations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Modèle"><select className="planner-field" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <div className="row">
          <Field label="Du"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Au"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Date du relevé"><DateInput value={issued} onChange={setIssued} /></Field>
          {kind === "fixed" && <Field label="Prix fixe par réservation (€)" help="Selon la taille de la copropriété"><input className="planner-field" list="fixed-prices" inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value.replace(/[^0-9.,]/g, ""))} /><datalist id="fixed-prices">{(P.org.fixedPrices || []).map((p) => <option key={p} value={p} />)}</datalist></Field>}
        </div>
        {kind === "hourly" && <label style={{ fontSize: 13, display: "block", marginBottom: 8 }}><input type="checkbox" checked={adhesion} onChange={(e) => setAdhesion(e.target.checked)} /> Ajouter l'adhésion ({fmtMoney(P.org.adhesionAmount)})</label>}
        {assoc && empty && <div className="banner banner-amber">Aucune séance validée et facturable sur cette période pour ce modèle. {kind === "stage" ? "Vérifiez qu'un stage validé existe pour cette association." : "Les séances en attente, refusées ou gratuites ne sont pas comptées."}</div>}
        {assoc && !empty && (
          <>
            <p className="help" style={{ margin: "4px 0 6px" }}>Aperçu du relevé :</p>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "auto", maxHeight: 480, background: "#fff" }}><StatementView st={st} /></div>
            <div style={{ textAlign: "right", marginTop: 10 }}><button className="btn btn-primary" onClick={create}>Enregistrer et imprimer</button></div>
          </>
        )}
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <h2 className="serif" style={{ marginRight: "auto" }}>Relevés de frais {b.start.slice(0, 4)}-{b.end.slice(0, 4)}</h2>
          <span className="help">Total {fmtMoney(totalBilled)} · Encaissé {fmtMoney(totalPaid)} · Reste {fmtMoney(round2(totalBilled - totalPaid))}</span>
          <select className="planner-field" style={{ width: 140 }} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Tous</option><option value="unpaid">À encaisser</option><option value="paid">Payés</option></select>
          <button className="btn" onClick={() => setBatch(true)}>Générer les relevés du mois</button>
          <button className="btn" onClick={() => download(`encaissements-${P.year}.csv`, "text/csv", "\ufeff" + paymentsCsv())}>Export compta (règlements)</button><button className="btn" onClick={() => download(`releves-de-frais-${P.year}.csv`, "text/csv", invoicesCsv(rows))}>Exporter CSV</button>
        </div>
        {(numCheck.dup.length > 0 || numCheck.gaps.length > 0) && <div className="banner banner-amber" style={{ marginBottom: 8 }}>Numérotation : {numCheck.dup.length > 0 && <>numéro(s) en double ({numCheck.dup.join(", ")}). </>}{numCheck.gaps.length > 0 && <>numéro(s) manquant(s) ({numCheck.gaps.slice(0, 8).join(", ")}{numCheck.gaps.length > 8 ? "…" : ""}) — probablement des relevés supprimés.</>}</div>}
        {canArchive() && <div className="help" style={{ marginBottom: 8 }}>Dossier d'archivage des PDF : <b>{archDir}</b> <button className="link" onClick={chooseDir}>Changer</button><button className="link" onClick={openArchiveDir}>Ouvrir</button></div>}
        {rows.length === 0 ? <p className="help">Aucun relevé de frais.</p> : (
          <table className="table"><thead><tr><th>Réf.</th><th>Destinataire</th><th>Modèle</th><th>Période</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Réglé</th><th>Statut</th><th></th></tr></thead>
            <tbody>{rows.map((i) => <tr key={i.id}><td>{i.number}</td><td>{i.associationName}</td><td className="help">{KINDS[i.kind] ? KINDS[i.kind].split(" (")[0] : "—"}</td><td>{frShort(i.periodStart)} → {frShort(i.periodEnd)}</td><td style={{ textAlign: "right" }}>{fmtMoney(i.total)}</td><td style={{ textAlign: "right" }}>{fmtMoney(i.amountPaid)}</td>
              <td><span className={"tag " + (i.amountPaid >= i.total ? "tag-green" : i.amountPaid > 0 ? "tag-amber" : "tag-red")}>{status(i)}</span>{i.lastReminderAt && <div className="help" style={{ fontSize: 11 }}>relancé {i.reminders > 1 ? i.reminders + " fois, " : ""}le {frShort(i.lastReminderAt.slice(0, 10))}</div>}{i.amountPaid < i.total && i.dueDate && i.dueDate < todayKey() && <div style={{ fontSize: 11, color: "#A32D2D", fontWeight: 600 }}>en retard de {Math.round((Date.parse(todayKey()) - Date.parse(i.dueDate)) / 86400000)} j</div>}{(i.sentAt || i.archivedAt) && <div className="help" style={{ fontSize: 11 }} title={i.archivedPath || ""}>{i.archivedAt ? "📁 archivé" : ""}{i.archivedAt && i.sentAt ? " · " : ""}{i.sentAt ? "✉ envoyé " + frShort(i.sentAt.slice(0, 10)) : ""}</div>}</td>
              <td style={{ whiteSpace: "nowrap" }}><button className="link" onClick={() => setPrint(i)}>Imprimer</button>{canArchive() && <button className="link" onClick={() => setPrint({ ...i, __auto: "pdf" })}>PDF</button>}<button className="link" onClick={() => (canArchive() ? setPrint({ ...i, __auto: "mail" }) : mail(i, false))}>E-mail</button>{i.amountPaid < i.total && <button className="link" onClick={() => mail(i, true)}>Relance</button>}{i.amountPaid < i.total && <button className="link" onClick={() => setPay(i)}>Règlement</button>}<button className="link link-danger" onClick={() => P.ask("Supprimer ce relevé de frais ?", () => P.deleteInvoice(i.id))}>Supprimer</button></td></tr>)}</tbody></table>
        )}
      </div>
      {print && <PrintLayer onClose={() => setPrint(null)} title={`Relevé de frais ${print.number}`} pdfName={`releve-de-frais-${print.number}`} extra={!print.__auto && <>{canArchive() && <button className="btn btn-primary" onClick={() => archive(print)}>Archiver le PDF</button>}<button className="btn" onClick={() => send(print)}>Envoyer par e-mail</button></>}><StatementView st={print} /></PrintLayer>}
      {batch && <BatchModal onClose={() => setBatch(false)} onDone={(recs) => { setBatch(false); setBatchPrint(recs); }} />}
      {batchPrint && <PrintLayer onClose={() => setBatchPrint(null)} title={`${batchPrint.length} relevé(s) de frais`} pdfName="releves-de-frais">{batchPrint.map((r, i) => <div key={r.id} className={i < batchPrint.length - 1 ? "sheet-break" : ""}><StatementView st={r} /></div>)}</PrintLayer>}
      {pay && <PaymentModal inv={pay} onClose={() => setPay(null)} />}
    </div>
  );
}
