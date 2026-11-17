// Semaine type : l'image d'une semaine ordinaire, déduite des séries hebdomadaires.
// Sert aussi de base au taux d'occupation et à l'estimation des recettes.
import { toMin, fromMin, round2, applicableRate, durationHours } from "./occurrences.js";
import { DEFAULT_OPEN_START, DEFAULT_OPEN_END } from "./constants.js";
import { isCoproAssoc, coproPrice } from "./billing.js";
import { schoolYearOf } from "./dates.js";

const OPEN_DAYS = 6; // lundi → samedi ; le dimanche ne compte que s'il est occupé

export function roomOpen(room) {
  const r = room || {};
  return { start: r.openStart || DEFAULT_OPEN_START, end: r.openEnd || DEFAULT_OPEN_END };
}

// Heures d'une séance effectivement comprises dans l'amplitude d'ouverture
export function hoursInOpen(start, end, open) {
  const a = Math.max(toMin(start) ?? 0, toMin(open.start) ?? 0);
  const b = Math.min(toMin(end) ?? 0, toMin(open.end) ?? 0);
  return b > a ? round2((b - a) / 60) : 0;
}

const daysOf = (r) => (r.days && r.days.length ? r.days : Number.isInteger(r.weekday) ? [r.weekday] : []);

// Une ligne par salle : ce qui s'y passe chaque jour d'une semaine ordinaire,
// les créneaux restés libres, et les heures réservées dans l'amplitude.
export function weekGrid({ recurring, rooms, associations, filters }) {
  const f = filters || {};
  const keep = (r) => {
    if (r.status === "annule") return false;
    if (f.assoc && f.assoc !== "all" && r.associationId !== f.assoc) return false;
    if (f.room && f.room !== "all" && r.roomId !== f.room) return false;
    return true;
  };
  const series = (recurring || []).filter((r) => r.frequency !== "daily" || true).filter(keep);
  return (rooms || []).filter((room) => !f.room || f.room === "all" || f.room === room.id).map((room) => {
    const open = roomOpen(room);
    const days = [[], [], [], [], [], [], []];
    for (const r of series) {
      if (r.roomId !== room.id) continue;
      const assoc = (associations || []).find((a) => a.id === r.associationId);
      const cell = { id: r.id, seriesId: r.id, name: (assoc && assoc.name) || r.customName || "Réservation", start: r.start, end: r.end, status: r.status, colorIdx: assoc ? assoc.colorIdx : null, assoc };
      for (const d of daysOf(r)) if (d >= 0 && d < 7) days[d].push(cell);
    }
    days.forEach((l) => l.sort((a, b) => (a.start || "").localeCompare(b.start || "")));
    const free = days.map((l) => freeRanges(l, open));
    const hours = round2(days.reduce((t, l) => t + l.reduce((u, c) => u + hoursInOpen(c.start, c.end, open), 0), 0));
    return { room, open, days, free, hours };
  });
}

// Les trous d'une journée, dans l'amplitude de la salle
function freeRanges(list, open) {
  const busy = list.map((c) => [toMin(c.start), toMin(c.end)]).filter((p) => p[0] != null && p[1] != null).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = toMin(open.start), end = toMin(open.end);
  for (const [s, e] of busy) {
    if (s > cur) out.push([cur, Math.min(s, end)]);
    cur = Math.max(cur, e);
  }
  if (cur < end) out.push([cur, end]);
  return out.filter(([s, e]) => e > s).map(([s, e]) => ({ start: fromMin(s), end: fromMin(e), label: `${fromMin(s)}–${fromMin(e)}` }));
}

// Taux d'occupation d'une ligne : heures réservées / heures ouvrables de la semaine
export function occupancy(row) {
  const open = row.open || roomOpen(row.room);
  const perDay = Math.max(0, ((toMin(open.end) ?? 0) - (toMin(open.start) ?? 0)) / 60);
  const sundayCounted = row.days[6] && row.days[6].length > 0;
  const openHours = round2(perDay * (OPEN_DAYS + (sundayCounted ? 1 : 0)));
  const busyHours = row.hours;
  const pct = openHours > 0 ? Math.min(100, Math.round((busyHours / openHours) * 100)) : 0;
  return { pct, busyHours, openHours, sundayCounted };
}

// « 0 % » alors qu'il y a des séances serait trompeur
export const pctLabel = (pct, busyHours) => (busyHours > 0 && pct === 0 ? "<1 %" : `${pct} %`);

// Estimation des recettes de l'année, salle par salle. Mêmes règles que les relevés
// de frais : tarif horaire pour les séances, prix fixe pour les copropriétés,
// prix par jour du stage réparti entre les salles de l'étage.
export function revenueByRoom({ sessions, stages, rooms, associations }) {
  const m = new Map();
  const add = (roomId, amount) => { if (roomId && amount > 0) m.set(roomId, round2((m.get(roomId) || 0) + amount)); };
  const byId = new Map((rooms || []).map((r) => [r.id, r]));
  for (const s of sessions || []) {
    if (s.status === "annule" || s.paymentStatus === "exempt" || s.stageId) continue;
    const room = byId.get(s.roomId);
    if (!room) continue;
    const assoc = (associations || []).find((a) => a.id === s.associationId);
    if (isCoproAssoc(assoc) || (!s.associationId && s.customName)) { add(s.roomId, coproPrice(room, assoc || {})); continue; }
    add(s.roomId, round2(durationHours(s.start, s.end) * applicableRate(room, assoc, s.date)));
  }
  for (const st of stages || []) {
    if (st.status === "annule" || st.paymentStatus === "exempt") continue;
    const ids = (st.roomIds || []).filter((id) => byId.has(id));
    if (!ids.length) continue;
    const share = round2((Number(st.dayPrice) || 0) * (st.dates || []).length / ids.length);
    for (const id of ids) add(id, share);
  }
  return m;
}

// Le reste de l'année, qui n'apparaît pas dans la semaine type
export function exceptionsCount({ bookings, stages, year }) {
  const b = (bookings || []).filter((x) => !x.stageId && x.status !== "annule" && x.startDate && schoolYearOf(x.startDate) === year).length;
  const s = (stages || []).filter((x) => x.status !== "annule" && (x.schoolYear === year || (x.dates && x.dates[0] && schoolYearOf(x.dates[0]) === year))).length;
  return { bookings: b, stages: s };
}
