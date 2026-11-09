import React, { useMemo, useState } from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { Modal, Field, NumInput, DateInput } from "../components/ui.jsx";
import { PrintLayer } from "../components/DailySheet.jsx";
import { buildInvoiceLines, round2 } from "../lib/planner/occurrences.js";
import { yearBounds, todayKey, frShort } from "../lib/planner/dates.js";
import { fmtMoney, fmtDec } from "../lib/planner/format.js";
import { PAYMENT_METHODS } from "../lib/planner/constants.js";
import { download, invoicesCsv } from "../lib/planner/exports.js";

function InvoicePrint({ inv, onClose }) {
  const P = usePlanner();
  const o = P.org;
  return (
    <PrintLayer onClose={onClose} title={`Facture ${inv.number}`}>
      <div className="inv-page">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
          <div><h2 className="serif" style={{ fontSize: 22 }}>{o.name || "Maison des jeunes de Saint Médard"}</h2><p style={{ whiteSpace: "pre-line" }}>{o.address}</p></div>
          <div style={{ textAlign: "right" }}><h1 className="serif">FACTURE</h1><p><b>{inv.number}</b></p><p>Émise le {frShort(inv.issuedAt)}</p><p>Échéance : {frShort(inv.dueDate)}</p></div>
        </div>
        <p style={{ margin: "24px 0 8px" }}>Facturé à : <b>{inv.associationName}</b></p>
        <p className="help" style={{ marginBottom: 12 }}>Période du {frShort(inv.periodStart)} au {frShort(inv.periodEnd)}</p>
        <table className="table"><thead><tr><th>Salle</th><th>Détail</th><th style={{ textAlign: "right" }}>Montant</th></tr></thead>
          <tbody>{inv.lines.map((l, i) => <tr key={i}><td>{l.label}</td><td>{l.detail}</td><td style={{ textAlign: "right" }}>{fmtMoney(l.amount)}</td></tr>)}</tbody></table>
        <p style={{ textAlign: "right", fontSize: 18, marginTop: 12 }}><b>Total : {fmtMoney(inv.total)}</b></p>
        <p style={{ textAlign: "right" }}>Réglé : {fmtMoney(inv.amountPaid)} · Reste dû : {fmtMoney(round2(inv.total - inv.amountPaid))}</p>
        {o.legal && <p className="help" style={{ marginTop: 30, whiteSpace: "pre-line" }}>{o.legal}</p>}
      </div>
    </PrintLayer>
  );
}

function PaymentModal({ inv, onClose }) {
  const P = usePlanner();
  const rest = round2(inv.total - inv.amountPaid);
  const [amount, setAmount] = useState(String(rest));
  const [method, setMethod] = useState("virement");
  const [date, setDate] = useState(todayKey());
  const [ref, setRef] = useState("");
  const submit = () => { const a = Number(String(amount).replace(",", ".")); if (!(a > 0)) return P.notify("Montant invalide", "error"); P.addInvoicePayment(inv.id, { amount: a, method, date, reference: ref }); onClose(); };
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

export default function Facturation() {
  const P = usePlanner();
  const b = yearBounds(P.year);
  const [assoc, setAssoc] = useState("");
  const [from, setFrom] = useState(b.start);
  const [to, setTo] = useState(b.end);
  const [print, setPrint] = useState(null);
  const [pay, setPay] = useState(null);
  const [filter, setFilter] = useState("all");
  React.useEffect(() => { setFrom(b.start); setTo(b.end); setAssoc(""); }, [P.year]);
  const calc = useMemo(() => (assoc ? buildInvoiceLines(P.allSessions(from, to), P.rooms, P.associations, assoc, from, to) : { lines: [], total: 0 }), [assoc, from, to, P.allSessions, P.rooms, P.associations]);
  const a = P.associations.find((x) => x.id === assoc);
  const create = () => { const rec = P.saveInvoice({ associationId: assoc, associationName: a.name, periodStart: from, periodEnd: to, lines: calc.lines, total: calc.total }); setPrint({ ...rec }); };
  const status = (i) => (i.amountPaid >= i.total ? "Payée" : i.amountPaid > 0 ? "Partiellement payée" : i.dueDate < todayKey() ? "En retard" : "Envoyée");
  const rows = P.invoices.filter((i) => filter === "all" || (filter === "unpaid" ? i.amountPaid < i.total : i.amountPaid >= i.total));
  const totalBilled = P.invoices.reduce((s, i) => s + i.total, 0), totalPaid = P.invoices.reduce((s, i) => s + i.amountPaid, 0);
  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="serif" style={{ marginBottom: 8 }}>Nouvelle facture</h2>
        <div className="row">
          <Field label="Association"><select className="planner-field" value={assoc} onChange={(e) => setAssoc(e.target.value)}><option value="">— Choisir —</option>{P.associations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Du"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Au"><DateInput value={to} onChange={setTo} /></Field>
        </div>
        {assoc && (calc.lines.length === 0 ? <p className="help">Aucune séance validée et facturable sur cette période.</p> : (
          <>
            <table className="table"><thead><tr><th>Salle</th><th>Détail</th><th style={{ textAlign: "right" }}>Montant</th></tr></thead>
              <tbody>{calc.lines.map((l, i) => <tr key={i}><td>{l.label}</td><td>{l.detail}</td><td style={{ textAlign: "right" }}>{fmtDec(l.amount)} €</td></tr>)}</tbody></table>
            <p style={{ textAlign: "right", margin: "8px 0" }}><b>Total : {fmtMoney(calc.total)}</b></p>
            <div style={{ textAlign: "right" }}><button className="btn btn-primary" onClick={create}>Enregistrer et imprimer la facture</button></div>
          </>
        ))}
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <h2 className="serif" style={{ marginRight: "auto" }}>Factures {b.start.slice(0, 4)}-{b.end.slice(0, 4)}</h2>
          <span className="help">Facturé {fmtMoney(totalBilled)} · Encaissé {fmtMoney(totalPaid)} · Reste {fmtMoney(round2(totalBilled - totalPaid))}</span>
          <select className="planner-field" style={{ width: 140 }} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Toutes</option><option value="unpaid">À encaisser</option><option value="paid">Payées</option></select>
          <button className="btn" onClick={() => download(`factures-${P.year}.csv`, "text/csv", invoicesCsv(rows))}>Exporter CSV</button>
        </div>
        {rows.length === 0 ? <p className="help">Aucune facture.</p> : (
          <table className="table"><thead><tr><th>N°</th><th>Association</th><th>Période</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Réglé</th><th>Statut</th><th></th></tr></thead>
            <tbody>{rows.map((i) => <tr key={i.id}><td>{i.number}</td><td>{i.associationName}</td><td>{frShort(i.periodStart)} → {frShort(i.periodEnd)}</td><td style={{ textAlign: "right" }}>{fmtMoney(i.total)}</td><td style={{ textAlign: "right" }}>{fmtMoney(i.amountPaid)}</td>
              <td><span className={"tag " + (i.amountPaid >= i.total ? "tag-green" : status(i) === "En retard" ? "tag-red" : "tag-amber")}>{status(i)}</span></td>
              <td style={{ whiteSpace: "nowrap" }}><button className="link" onClick={() => setPrint(i)}>Imprimer</button>{i.amountPaid < i.total && <button className="link" onClick={() => setPay(i)}>Règlement</button>}<button className="link link-danger" onClick={() => P.ask("Supprimer cette facture ?", () => P.deleteInvoice(i.id))}>Supprimer</button></td></tr>)}</tbody></table>
        )}
      </div>
      {print && <InvoicePrint inv={print} onClose={() => setPrint(null)} />}
      {pay && <PaymentModal inv={pay} onClose={() => setPay(null)} />}
    </div>
  );
}
