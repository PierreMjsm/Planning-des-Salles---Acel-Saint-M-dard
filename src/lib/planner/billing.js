// Périodicité des relevés de frais, rappels « à facturer » et copropriétés à la réservation.
import { addDays, toKey } from "./dates.js";

export const FREQS = {
  bimonthly: "Tous les 2 mois (sept.-oct., nov.-déc., …)",
  monthly: "Tous les mois",
  quarterly: "Tous les 3 mois",
  vacations: "Après chaque vacances scolaires",
};
export const FREQ_SHORT = { bimonthly: "2 mois", monthly: "mensuel", quarterly: "trimestriel", vacations: "après vacances" };

const pad = (n) => String(n).padStart(2, "0");
const monthEnd = (y, m) => toKey(y, m, new Date(y, m + 1, 0).getDate()); // m = 0..11
const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Fréquence effective d'une association (réglage, sinon ASB = mensuel, stages = après vacances, sinon 2 mois)
export function freqOf(assoc, hasStage) {
  if (assoc.billingFreq) return assoc.billingFreq;
  if (/^asb$/i.test((assoc.name || "").trim())) return "monthly";
  if (assoc.billingMode === "stage" || hasStage) return "vacations";
  return "bimonthly";
}

// Périodes d'une année scolaire (septembre → août) pour une fréquence donnée
export function periodsFor(freq, year, vacations = []) {
  if (freq === "vacations") {
    // Chaque période va du lendemain des vacances précédentes à la fin des vacances suivantes :
    // un stage placé hors vacances (week-ends, par exemple) est donc rappelé lui aussi.
    const vs = vacations.filter((v) => v.startDate >= `${year}-09-01` && v.startDate <= `${year + 1}-08-31` && !/été/i.test(v.label || ""))
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    const out = []; let from = `${year}-09-01`;
    for (const v of vs) {
      if (v.endDate < from) continue;
      out.push({ from, to: v.endDate, label: "Jusqu'à la fin des vacances · " + (v.label || "Vacances").replace(/^Vacances (de la |de |d'|du |des )?/i, "").replace(/^./, (c) => c.toUpperCase()) });
      from = addDays(v.endDate, 1);
    }
    if (from <= `${year + 1}-08-31`) out.push({ from, to: `${year + 1}-08-31`, label: vs.length ? "Fin d'année" : "Année scolaire" });
    return out;
  }
  const step = freq === "monthly" ? 1 : freq === "quarterly" ? 3 : 2;
  const out = [];
  // mois 0..11 de la suite septembre(8) → août(7)
  for (let i = 0; i < 12; i += step) {
    const m1 = (8 + i) % 12, y1 = year + Math.floor((8 + i) / 12);
    const m2 = (8 + i + step - 1) % 12, y2 = year + Math.floor((8 + i + step - 1) / 12);
    out.push({ from: `${y1}-${pad(m1 + 1)}-01`, to: monthEnd(y2, m2), label: step === 1 ? `${cap(MONTH_NAMES[m1])}` : `${cap(MONTH_NAMES[m1])} - ${cap(MONTH_NAMES[m2])}` });
  }
  return out;
}

export const isCoproAssoc = (a) => !!(a && Number(a.fixedPrice) > 0);
export const coproName = (s) => String(s || "").replace(/^\s*copropri[ée]t[ée]\s*:?\s*/i, "").replace(/^\s*copro\s*:?\s*/i, "").trim();

// Prix copropriété selon la salle (réglage de la salle, sinon premier prix fixe de l'organisation)
export const coproPrice = (room, org) => Number(room && room.copropPrice) || Number((org.fixedPrices || [])[0]) || 0;

const covered = (invoices, pred, date) => invoices.some((i) => pred(i) && i.periodStart <= date && i.periodEnd >= date);

// Éléments à facturer : { key, type: 'period'|'copro', assoc?, kind, period?, sessions|session, status: 'overdue'|'soon', label }
export function dueBilling({ associations, sessions, stages, invoices, vacations, year, today, lead = 6 }) {
  const items = [];
  const soonLimit = addDays(today, lead);
  for (const a of associations) {
    if (isCoproAssoc(a) && a.billingMode !== "hourly") continue; // les copropriétés « association » se facturent à la réservation
    const hasStage = stages.some((s) => s.associationId === a.id);
    const freq = freqOf(a, hasStage);
    const kinds = a.billingMode ? [a.billingMode] : hasStage ? ["hourly", "stage"] : ["hourly"];
    for (const kind of kinds) {
      const f = kind === "stage" && !a.billingFreq ? "vacations" : freq;
      const periods = periodsFor(f, year, vacations);
      for (const p of periods) {
        if (p.from > today || p.to > soonLimit) continue;
        let mine;
        if (kind === "stage") {
          mine = stages.filter((st) => st.associationId === a.id && st.status === "confirme" && st.paymentStatus !== "exempt")
            .flatMap((st) => st.dates.filter((d) => d >= p.from && d <= p.to).map((d) => ({ id: `stage:${st.id}:${d}`, date: d })));
        } else {
          mine = sessions.filter((s) => !s.stageId && s.associationId === a.id && s.status === "confirme" && s.paymentStatus !== "exempt" && s.date >= p.from && s.date <= p.to);
        }
        const open = mine.filter((s) => !covered(invoices, (i) => i.associationId === a.id && (i.kind || "hourly") === kind, s.date));
        if (!open.length) continue;
        items.push({ key: `${a.id}|${kind}|${p.from}`, type: "period", assoc: a, kind, freq: f, period: p, count: open.length, status: p.to < today ? "overdue" : "soon", label: p.label });
      }
    }
  }
  // Copropriétés : réservation à nom libre (sans association), un relevé par réunion
  const done = new Set(invoices.flatMap((i) => i.sourceIds || []));
  for (const s of sessions) {
    if (s.associationId || !s.customName || s.stageId || s.status !== "confirme" || s.paymentStatus === "exempt") continue;
    if (done.has(s.id) || s.date >= today) continue; // proposé une fois la réunion passée
    items.push({ key: "copro|" + s.id, type: "copro", kind: "fixed", session: s, status: "overdue", label: coproName(s.customName) });
  }
  const order = (x) => (x.status === "overdue" ? 0 : 1);
  return items.sort((a, b) => order(a) - order(b) || (a.period ? a.period.to : a.session.date).localeCompare(b.period ? b.period.to : b.session.date));
}

