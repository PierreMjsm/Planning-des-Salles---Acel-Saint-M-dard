import { DAY_START, DAY_END } from "./constants.js";
import { eachDay, weekdayIndex, isWeekend } from "./dates.js";
import { fmtDec, fmtHours } from "./format.js";

const pad = (n) => String(n).padStart(2, "0");
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function toMin(t) {
  if (!t || t.indexOf(":") === -1) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export function durationHours(start, end) {
  const s = toMin(start);
  const e = toMin(end);
  if (s == null || e == null || e <= s) return 0;
  return (e - s) / 60;
}
export function timesOverlap(s1, e1, s2, e2) {
  const a1 = toMin(s1), b1 = toMin(e1), a2 = toMin(s2), b2 = toMin(e2);
  if (a1 == null || b1 == null || a2 == null || b2 == null) return false;
  return a1 < b2 && a2 < b1;
}
export function momentOf(start) {
  const m = toMin(start);
  if (m == null) return "morning";
  if (m < 720) return "morning";
  if (m < 1080) return "afternoon";
  return "evening";
}

function baseSession(src, kind, date) {
  return {
    id: `${kind}:${src.id}:${date}`,
    kind,
    sourceId: src.id,
    date,
    roomId: src.roomId,
    associationId: src.associationId || "",
    customName: src.customName || "",
    start: src.start,
    end: src.end,
    participants: src.participants || "",
    contact: src.contact || "",
    equipment: src.equipment || "",
    note: src.note || "",
    internalNote: src.internalNote || "",
    status: src.status || "confirme",
    paymentStatus: src.paymentStatus || "unpaid",
    startDate: src.startDate,
    endDate: src.endDate,
    stageId: src.stageId || "",
  };
}

export function seriesMatchesDay(r, date) {
  const idx = weekdayIndex(date);
  if (r.frequency === "daily") return true;
  if (r.frequency === "weekdays") return idx <= 4;
  if (Array.isArray(r.days) && r.days.length) return r.days.includes(idx);
  return idx === r.weekday;
}

export function sessionsInRange(bookings, recurring, from, to, vacations = []) {
  const out = [];
  for (const b of bookings) {
    const lo = b.startDate > from ? b.startDate : from;
    const hi = b.endDate < to ? b.endDate : to;
    if (lo > hi) continue;
    for (const d of eachDay(lo, hi)) out.push(baseSession(b, "booking", d));
  }
  for (const r of recurring) {
    const lo = r.startDate > from ? r.startDate : from;
    const hi = r.endDate < to ? r.endDate : to;
    if (lo > hi) continue;
    const ex = r.exceptions || [];
    for (const d of eachDay(lo, hi)) {
      if (!seriesMatchesDay(r, d) || ex.includes(d)) continue;
      if (r.skipVacations && vacations.length && vacations.some((v) => v.startDate <= d && d <= v.endDate)) continue;
      out.push({ ...baseSession(r, "series", d), frequency: r.frequency, weekday: r.weekday, days: r.days });
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || "").localeCompare(b.start || "") || a.id.localeCompare(b.id)));
  return out;
}

export function groupByDay(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date).push(s);
  }
  return map;
}

export function sessionName(s, associations) {
  const a = associations.find((x) => x.id === s.associationId);
  return (a && a.name) || s.customName || "Réservation";
}

export function matchesFilters(s, f) {
  if (f.assoc !== "all" && s.associationId !== f.assoc) return false;
  if (f.room !== "all" && s.roomId !== f.room) return false;
  if (f.status !== "all" && s.status !== f.status) return false;
  if (f.payment !== "all" && s.paymentStatus !== f.payment) return false;
  if (f.moment !== "all" && momentOf(s.start) !== f.moment) return false;
  return true;
}

export const activeSessions = (list) => list.filter((s) => s.status !== "annule");

// mode "same" : deux séances de la même salle ; "other" : deux séances de salles différentes
export function conflictPairs(list, mode = "same") {
  const a = activeSessions(list);
  const pairs = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const sameRoom = a[i].roomId === a[j].roomId;
      if ((mode === "same") !== sameRoom) continue;
      if (timesOverlap(a[i].start, a[i].end, a[j].start, a[j].end)) pairs.push([a[i], a[j]]);
    }
  }
  return pairs;
}
export function conflictText(pairs, associations) {
  return pairs
    .map(([x, y]) => `${sessionName(x, associations)} (${x.start}-${x.end}) ↔ ${sessionName(y, associations)} (${y.start}-${y.end})`)
    .join(" · ");
}

export function freeSlots(list, from = DAY_START, to = DAY_END) {
  const busy = activeSessions(list)
    .map((s) => [toMin(s.start), toMin(s.end)])
    .filter((p) => p[0] != null && p[1] != null)
    .sort((a, b) => a[0] - b[0]);
  const free = [];
  let cursor = toMin(from);
  const end = toMin(to);
  for (const [s, e] of busy) {
    if (s > cursor) free.push([cursor, Math.min(s, end)]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < end) free.push([cursor, end]);
  return free.filter(([s, e]) => e > s).map(([s, e]) => `${fromMin(s)}–${fromMin(e)}`);
}

export function vacationFor(vacations, date) {
  return vacations.find((v) => v.startDate <= date && date <= v.endDate) || null;
}
export function closureFor(closures, roomId, date) {
  return closures.find((c) => c.startDate <= date && date <= c.endDate && (!c.roomId || c.roomId === roomId)) || null;
}
export function closureInRange(closures, roomId, from, to) {
  return closures.find((c) => c.startDate <= to && c.endDate >= from && (!c.roomId || c.roomId === roomId)) || null;
}

const has = (v) => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));
export function applicableRate(room, assoc, date) {
  if (!room) return 0;
  let rate = Number(room.rate) || 0;
  if (isWeekend(date) && has(room.rateWeekend)) rate = Number(room.rateWeekend);
  else if (assoc && assoc.isExternal && has(room.rateExternal)) rate = Number(room.rateExternal);
  const coef = Number(assoc && assoc.rateCoef) || 100;
  return round2((rate * coef) / 100);
}

export function buildInvoiceLines(sessions, rooms, associations, associationId, from, to, stages = []) {
  const assoc = associations.find((a) => a.id === associationId);
  const groups = new Map();
  const stageDays = new Map();
  for (const s of sessions) {
    if (!associationId || s.associationId !== associationId) continue;
    if (s.status !== "confirme" || s.paymentStatus === "exempt") continue;
    if (s.date < from || s.date > to) continue;
    if (s.stageId) { stageDays.set(s.stageId, (stageDays.get(s.stageId) || new Set()).add(s.date)); continue; }
    const h = durationHours(s.start, s.end);
    if (h <= 0) continue;
    const room = rooms.find((r) => r.id === s.roomId);
    const rate = applicableRate(room, assoc, s.date);
    const key = `${s.roomId}|${rate}`;
    if (!groups.has(key)) groups.set(key, { roomId: s.roomId, label: room ? room.name : "Salle supprimée", rate, count: 0, hours: 0 });
    const g = groups.get(key);
    g.count += 1;
    g.hours += h;
  }
  const stageLines = [];
  for (const [id, set] of stageDays) {
    const st = stages.find((x) => x.id === id);
    if (!st) continue;
    const n = set.size;
    const price = Number(st.dayPrice) || 0;
    stageLines.push({ roomId: "", label: `${st.label} — ${st.floorName}`, detail: `${n} jour(s) × ${fmtDec(price)} €/jour`, hours: 0, rate: price, amount: round2(n * price) });
  }
  const lines = [...groups.values()]
    .map((g) => {
      const hours = round2(g.hours);
      return {
        roomId: g.roomId,
        label: g.label,
        detail: `${g.count} séance(s) · ${fmtHours(hours)} × ${fmtDec(g.rate)} €/h`,
        hours,
        rate: g.rate,
        amount: round2(hours * g.rate),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr") || a.rate - b.rate)
    .concat(stageLines);
  return { lines, total: round2(lines.reduce((sum, l) => sum + l.amount, 0)) };
}
