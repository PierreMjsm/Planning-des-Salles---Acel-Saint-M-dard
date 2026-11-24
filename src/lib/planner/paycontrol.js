// Contrôle des paiements d'une période : la liste de tous ceux qui sont venus,
// associations régulières comme réservations ponctuelles, pour qu'aucune petite
// association venue une seule fois ne soit oubliée au moment de vérifier.
import { billable, durationHours, applicableRate, round2 } from "./occurrences.js";
import { isCoproAssoc, coproPrice, coproName, payerKindOf, isFreeName } from "./billing.js";

export const payerKey = (s) => s.associationId || "nom:" + (s.customName || "—");

// Montant estimé d'une séance, mêmes règles que les relevés de frais
function sessionAmount(s, rooms, associations) {
  const room = rooms.find((r) => r.id === s.roomId);
  if (!room) return 0;
  const assoc = associations.find((a) => a.id === s.associationId);
  // un particulier (répétition, anniversaire) se facture à l'heure, pas au prix copropriété
  if (isFreeName(s) && payerKindOf(s) === "particulier") return round2(durationHours(s.start, s.end) * applicableRate(room, null, s.date));
  if (isCoproAssoc(assoc) || isFreeName(s)) return coproPrice(room, assoc || {});
  return round2(durationHours(s.start, s.end) * applicableRate(room, assoc, s.date));
}

// Un relevé couvre la période dès qu'il la chevauche
const covers = (inv, row, from, to) => {
  const same = inv.associationId ? inv.associationId === row.assocId : !row.assocId && inv.associationName === row.name;
  return same && inv.periodStart <= to && inv.periodEnd >= from;
};

export function controlRows({ sessions, invoices, associations, rooms, stages, from, to }) {
  const byPayer = new Map();
  for (const s of billable(sessions || [])) {
    if (s.status !== "confirme" || s.paymentStatus === "exempt") continue;
    if (s.date < from || s.date > to) continue;
    const k = payerKey(s);
    if (!byPayer.has(k)) {
      const assoc = associations.find((a) => a.id === s.associationId);
      byPayer.set(k, { key: k, assocId: s.associationId || "", name: assoc ? assoc.name : payerKindOf(s) === "particulier" ? String(s.customName).trim() : coproName(s.customName), sessions: 0, stages: 0,
        firstDate: s.date, lastDate: s.date, estimated: 0, kinds: new Set(), sourceIds: new Set(), unpaidSources: 0, paidSources: 0 });
    }
    const r = byPayer.get(k);
    r.sessions++;
    if (s.date < r.firstDate) r.firstDate = s.date;
    if (s.date > r.lastDate) r.lastDate = s.date;
    r.estimated = round2(r.estimated + (s.stageId ? 0 : sessionAmount(s, rooms, associations)));
    r.kinds.add(s.kind);
    r.sourceIds.add(s.kind + ":" + s.sourceId);
    if (s.paymentStatus === "paid") r.paidSources++; else r.unpaidSources++;
  }
  // les stages comptent au prix du jour, comme sur la facture
  for (const st of stages || []) {
    if (st.status !== "confirme" || st.paymentStatus === "exempt") continue;
    const dates = (st.dates || []).filter((d) => d >= from && d <= to);
    if (!dates.length) continue;
    const k = st.associationId || "nom:" + (st.customName || "—");
    const r = byPayer.get(k);
    if (!r) continue;
    r.stages++;
    r.estimated = round2(r.estimated + dates.length * (Number(st.dayPrice) || 0));
  }
  const rows = [...byPayer.values()].map((r) => {
    const invs = (invoices || []).filter((i) => covers(i, r, from, to));
    const invoiced = round2(invs.reduce((t, i) => t + Number(i.total || 0), 0));
    const paid = round2(invs.reduce((t, i) => t + Number(i.amountPaid || 0), 0));
    const allInvoicesPaid = invs.length > 0 && invs.every((i) => Number(i.amountPaid || 0) >= round2(Number(i.total || 0)) - 0.005);
    const settled = invs.length ? allInvoicesPaid : r.unpaidSources === 0 && r.paidSources > 0;
    const state = invs.length === 0 ? "no-invoice" : allInvoicesPaid ? "ok" : "to-cash";
    return { ...r, kinds: [...r.kinds], sourceIds: [...r.sourceIds], invoices: invs, invoiced, paid,
      rest: round2(invoiced - paid), amount: invs.length ? invoiced : r.estimated, settled, state };
  });
  rows.sort((a, b) => Number(a.settled) - Number(b.settled) || a.name.localeCompare(b.name, "fr"));
  return rows;
}

export function controlSummary(rows) {
  const done = rows.filter((r) => r.settled);
  const rest = round2(rows.reduce((t, r) => t + (r.settled ? 0 : r.amount), 0));
  return { total: rows.length, done: done.length, left: rows.length - done.length, rest, noInvoice: rows.filter((r) => r.state === "no-invoice").length };
}
