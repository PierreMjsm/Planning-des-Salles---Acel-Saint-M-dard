// Liste des associations locataires : une ligne par créneau hebdomadaire,
// reconstruite depuis les séries du planning. Sert aussi à repérer les
// associations de l'année qui n'ont encore aucun créneau.
import { WEEKDAYS } from "./constants.js";
import { roomsOf } from "./occurrences.js";

export const hm = (t) => { const [h, m] = String(t || "").split(":"); return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`; };
export const slotLabel = (start, end) => (start && end ? `de ${hm(start)} à ${hm(end)}` : "");

const daysOf = (r) => (r.days && r.days.length ? r.days : Number.isInteger(r.weekday) ? [r.weekday] : []);

// sessions : les séances de l'année (pour compter les semaines réellement prévues)
export function tenantRows({ associations, recurring, rooms, sessions }) {
  const roomName = (id) => (rooms.find((r) => r.id === id) || {}).name || "Salle supprimée";
  // nombre de séances par série et par jour de la semaine
  const weeks = new Map();
  for (const s of sessions || []) {
    if (s.kind !== "series" || s.status === "annule") continue;
    if (s.multi && !s.primaryRoom) continue;
    const wd = (new Date(s.date + "T12:00:00").getDay() + 6) % 7;
    const k = s.sourceId + "|" + wd;
    weeks.set(k, (weeks.get(k) || 0) + 1);
  }
  const rows = [];
  for (const a of associations) {
    const mine = (recurring || []).filter((r) => r.associationId === a.id && r.status !== "annule");
    if (!mine.length) { rows.push({ assocId: a.id, name: a.name, address: a.address || "", rooms: "", day: "", hours: "", weeks: 0, none: true, status: "" }); continue; }
    const lines = [];
    for (const r of mine) {
      const names = roomsOf(r).map(roomName).join(", ");
      for (const d of daysOf(r)) {
        if (d < 0 || d > 6) continue;
        lines.push({ assocId: a.id, name: a.name, address: a.address || "", rooms: names, day: WEEKDAYS[d], weekday: d,
          hours: slotLabel(r.start, r.end), start: r.start, weeks: weeks.get(r.id + "|" + d) || 0, seriesId: r.id, status: r.status, none: false });
      }
    }
    lines.sort((x, y) => x.weekday - y.weekday || String(x.start).localeCompare(String(y.start)));
    rows.push(...lines);
  }
  return rows;
}

export function tenantSummary(rows) {
  const withSlot = new Set(rows.filter((r) => !r.none).map((r) => r.assocId));
  const without = rows.filter((r) => r.none);
  const noAddress = new Set(rows.filter((r) => !r.address).map((r) => r.assocId));
  return { associations: withSlot.size + without.length, withSlot: withSlot.size, without: without.length, slots: rows.filter((r) => !r.none).length, noAddress: noAddress.size };
}
