// « Demande de mise à disposition » : le document remis à chaque association,
// dont le tableau des tarifs se construit tout seul à partir du prix par salle.
import { CONVENTION_SECTIONS, ROOM_CONVENTION } from "./constants.js";
import { yearLabel } from "./dates.js";

const pad = (n) => String(n).padStart(2, "0");
const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Premier lundi de septembre : la rentrée des activités
export function firstMondayOfSeptember(year) {
  const d = new Date(Date.UTC(year, 8, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Valeurs de départ, dans l'esprit du courrier déjà envoyé les années passées
export function conventionDefaults(year, today) {
  return {
    letterDate: today,
    openingDate: firstMondayOfSeptember(year),
    returnDeadline: key(year, 6, 15),      // retour de la fiche : 15 juin
    minorsDeadline: key(year, 10, 30),     // liste des mineurs : 30 octobre
    signatories: "Katell LAUQUET et Pierre RETOURNARD",
  };
}
export const conventionSettings = (org, year, today) => ({ ...conventionDefaults(year, today), ...((org && org.convention) || {}) });
export const seasonLabel = (year) => yearLabel(year).replace("-", "/");

// La salle telle qu'elle figure au tableau des tarifs : ce que le réglage dit,
// sinon les valeurs connues du document, sinon rien (la salle n'y figure pas).
export function roomConvention(room) {
  const known = ROOM_CONVENTION[room.name] || null;
  // Non renseigné : on prend la valeur connue du document. Vidé à la main : la salle
  // est volontairement écartée du tableau.
  const section = room.conventionSection === undefined || room.conventionSection === null ? (known ? known.section : "") : room.conventionSection;
  const zone = room.conventionZone || (known ? known.zone : "") || "";
  const label = room.conventionLabel || (known && known.label) || room.name;
  return { section, zone, label };
}

// Le tableau, section par section, dans l'ordre du document
export function tariffTable(rooms) {
  const out = [];
  const seen = new Set();
  const sections = [...CONVENTION_SECTIONS];
  for (const r of rooms || []) { const c = roomConvention(r); if (c.section && !sections.includes(c.section)) sections.push(c.section); }
  for (const section of sections) {
    const lines = [];
    for (const r of rooms || []) {
      const c = roomConvention(r);
      if (c.section !== section) continue;
      seen.add(r.id);
      lines.push({ roomId: r.id, label: c.label, zone: c.zone, rate: Number(r.rate) || 0 });
    }
    if (lines.length) out.push({ section, lines });
  }
  return out;
}

// Salles absentes du tableau : à ranger dans une section, ou volontairement écartées
export function roomsOutside(rooms) {
  return (rooms || []).filter((r) => !roomConvention(r).section);
}
// Salles qui n'ont aucun prix : le tableau afficherait « 0 euros »
export const roomsWithoutRate = (rooms) => (rooms || []).filter((r) => roomConvention(r).section && !(Number(r.rate) > 0));

// Suivi des fiches : envoyées, rendues, à relancer passée la date limite
export function conventionTracking(associations, deadline, today) {
  const rows = (associations || []).map((a) => ({
    id: a.id, name: a.name, sentAt: a.conventionSentAt || "", receivedAt: a.conventionReceivedAt || "",
    // en retard seulement si la fiche a bien été remise à l'association
    late: !!a.conventionSentAt && !a.conventionReceivedAt && !!deadline && today > deadline,
  }));
  rows.sort((a, b) => Number(!!a.receivedAt) - Number(!!b.receivedAt) || a.name.localeCompare(b.name, "fr"));
  return rows;
}
export function trackingSummary(rows) {
  const received = rows.filter((r) => r.receivedAt).length;
  const sent = rows.filter((r) => r.sentAt).length;
  return { total: rows.length, sent, received, missing: rows.length - received, late: rows.filter((r) => r.late).length };
}
