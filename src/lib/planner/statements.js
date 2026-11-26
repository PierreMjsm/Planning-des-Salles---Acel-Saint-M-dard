import { fmtDec } from "./format.js";
import { durationHours, applicableRate, round2, billable } from "./occurrences.js";
import { parseKey } from "./dates.js";
import { MONTHS, WEEKDAYS, STAGE_KINDS } from "./constants.js";
import { coproName } from "./billing.js";

const pad = (n) => String(n).padStart(2, "0");
export const dmy = (k) => { const d = parseKey(k); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const dmy2 = (k) => dmy(k).slice(0, 6) + dmy(k).slice(8);
export const hm = (t) => { const [h, m] = (t || "").split(":"); return `${h}h${m}`; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthsLabel(from, to) {
  const a = parseKey(from), b = parseKey(to);
  const ma = cap(MONTHS[a.getMonth()]), mb = cap(MONTHS[b.getMonth()]);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return ma;
  return `${ma} - ${mb}`;
}
export function frLongDay(k) {
  const d = parseKey(k);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Libellé d'un groupe de salles au même prix, comme sur les factures envoyées
// aux organismes : « Salles du 3ème étage », « Salles 2ème et 3ème étage »,
// « Salles Bords de Bièvre / Carré Censier ».
const ETAGE = /^(\d+)\s*(?:er|ère|e|ème)\s+étage$/i;
export function floorsLabel(floors) {
  const list = floors || [];
  if (!list.length) return "Salles";
  if (list.length === 1) return ETAGE.test(list[0]) ? `Salles du ${list[0]}` : `Salles ${list[0]}`;
  if (list.every((f) => ETAGE.test(f))) {
    const parts = [...list].sort((a, b) => Number(ETAGE.exec(a)[1]) - Number(ETAGE.exec(b)[1])).map((f) => f.replace(/\s+étage$/i, ""));
    return `Salles ${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]} étage`;
  }
  return `Salles ${list.join(" / ")}`;
}

export const KINDS = { hourly: "Association (tarif horaire)", fixed: "Copropriété (prix fixe)", stage: "Stage BAFA (prix par étage et par jour)" };

// Construit un relevé de frais (les trois modèles) à partir des séances et stages de la période
export function buildStatement({ kind, assoc, sessions, rooms, stages, floors, from, to, fixedPrice, withAdhesion, org, issuedAt }) {
  const base = {
    kind, associationId: assoc.id, associationName: assoc.name, billingName: assoc.billingName || "", address: assoc.address || "", email: assoc.email || "",
    periodStart: from, periodEnd: to, issuedAt, monthsLabel: monthsLabel(from, to), rows: [], extras: [], groups: [], total: 0, totalHours: 0, roomsLabel: "",
  };
  const mine = billable(sessions).filter((s) => s.associationId === assoc.id && s.status === "confirme" && s.paymentStatus !== "exempt" && s.date >= from && s.date <= to);
  if (kind === "stage") {
    const rows = [];
    const byPrice = new Map();
    for (const st of stages) {
      if (st.associationId !== assoc.id || st.status !== "confirme" || st.paymentStatus === "exempt") continue;
      const dates = st.dates.filter((d) => d >= from && d <= to);
      if (!dates.length) continue;
      const fl = floors.find((f) => f.name === st.floorName);
      const floorLabel = (fl && fl.statementLabel) || st.floorName;
      const k = STAGE_KINDS[st.kind];
      rows.push({ label: (k && k.short) || st.label, from: dates[0], to: dates[dates.length - 1], days: dates.length, floor: floorLabel });
      const price = Number(st.dayPrice) || 0;
      if (!byPrice.has(price)) byPrice.set(price, { price, days: 0, floors: [] });
      const g = byPrice.get(price);
      g.days += dates.length;
      if (!g.floors.includes(floorLabel)) g.floors.push(floorLabel);
    }
    rows.sort((a, b) => (a.from < b.from ? -1 : 1));
    // ordre du bâtiment (celui des étages réglés), pas l'ordre d'apparition des stages
    const rank = (lbl) => { const i = floors.findIndex((f) => (f.statementLabel || f.name) === lbl); return i < 0 ? 99 : i; };
    const groups = [...byPrice.values()].map((g) => ({ label: floorsLabel([...g.floors].sort((a, b) => rank(a) - rank(b))), days: g.days, price: g.price, amount: round2(g.days * g.price) }));
    return { ...base, rows, groups, total: round2(groups.reduce((s, g) => s + g.amount, 0)), from: rows.length ? rows.reduce((m, r) => (r.from < m ? r.from : m), rows[0].from) : from, to: rows.length ? rows.reduce((m, r) => (r.to > m ? r.to : m), rows[0].to) : to };
  }
  const noStage = mine.filter((s) => !s.stageId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start.localeCompare(b.start)));
  const roomNames = [...new Set(noStage.map((s) => (rooms.find((r) => r.id === s.roomId) || {}).name).filter(Boolean))];
  base.roomsLabel = roomNames.join(", ");
  base.multiRoom = roomNames.length > 1;
  if (kind === "fixed") {
    const price = Number(fixedPrice) || 0;
    base.rows = noStage.map((s) => ({ date: s.date, label: frLongDay(s.date), room: (rooms.find((r) => r.id === s.roomId) || {}).name || "", start: s.start, end: s.end, amount: price }));
    base.total = round2(price * base.rows.length);
    return base;
  }
  base.rows = noStage.map((s) => {
    const room = rooms.find((r) => r.id === s.roomId);
    const hours = durationHours(s.start, s.end);
    const rate = applicableRate(room, assoc, s.date);
    return { date: s.date, label: assoc.name, room: room ? room.name : "", hours, rate, amount: round2(hours * rate) };
  });
  base.totalHours = round2(base.rows.reduce((t, r) => t + r.hours, 0));
  let total = base.rows.reduce((t, r) => t + r.amount, 0);
  if (withAdhesion) {
    const amount = Number(org.adhesionAmount) || 0;
    base.extras.push({ label: `${org.adhesionLabel} ${parseKey(to).getFullYear()}`, amount });
    total += amount;
  }
  base.total = round2(total);
  return base;
}
export { fmtDec };

// Relevé d'une réservation à nom libre : une réunion de copropriété au prix fixe de
// la salle, ou un particulier (répétition, anniversaire) au tarif horaire.
export function buildCoproStatement({ session, room, price, issuedAt, name, kind = "fixed", hours = 0, rooms, sessions }) {
  const email = /@/.test(session.contact || "") ? String(session.contact).trim() : "";
  // Réservation cochée sur plusieurs salles : un seul relevé, qui les nomme toutes
  // et qui couvre toutes leurs séances pour ne pas réapparaître à facturer.
  const noms = (rooms && rooms.length ? rooms.map((r) => r && r.name).filter(Boolean) : [(room && room.name) || ""]).filter(Boolean);
  const label = noms.join(" · ");
  const ids = sessions && sessions.length ? sessions.map((x) => x.id) : [session.id];
  return {
    kind, associationId: "", associationName: name || coproName(session.customName), address: "", email,
    periodStart: session.date, periodEnd: session.date, issuedAt, monthsLabel: monthsLabel(session.date, session.date),
    rows: [{ date: session.date, label: frLongDay(session.date), room: label, start: session.start, end: session.end, amount: Number(price) || 0 }],
    extras: [], groups: [], total: round2(Number(price) || 0), totalHours: round2(hours), roomsLabel: label, sourceIds: ids, coproBooking: true,
  };
}
