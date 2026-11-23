// Lecture d'un mail écrit à la main : on y cherche des dates, des horaires, une
// salle et un demandeur, pour pré-remplir une réservation. Rien n'est enregistré
// sans relecture : le logiciel propose, l'utilisateur corrige.
import { todayKey, schoolYearOf } from "./dates.js";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_RE = "janv(?:ier)?|f[ée]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept?(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?";
const pad = (n) => String(n).padStart(2, "0");
export const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function monthIndex(word) {
  const w = fold(word).slice(0, 4);
  const i = MOIS.findIndex((m) => fold(m).startsWith(w.slice(0, 3)) && (w.slice(0, 4) !== "juil" ? true : true));
  if (fold(word).startsWith("juil")) return 6;
  if (fold(word).startsWith("juin")) return 5;
  if (fold(word).startsWith("mar")) return 2;
  if (fold(word).startsWith("mai")) return 4;
  return i;
}

// Une date sans année : on prend celle qui tombe dans l'avenir proche
function withYear(day, month, today) {
  const t = new Date(today + "T12:00:00");
  for (const y of [t.getFullYear(), t.getFullYear() + 1]) {
    const k = `${y}-${pad(month + 1)}-${pad(day)}`;
    if (k >= today) return k;
  }
  return `${t.getFullYear() + 1}-${pad(month + 1)}-${pad(day)}`;
}

export function findDates(text, today = todayKey()) {
  const out = [];
  const add = (d) => { if (d && !out.includes(d)) out.push(d); };
  const src = String(text || "");
  // 12/03/2026, 12-03-26, 12.03
  for (const m of src.matchAll(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g)) {
    const d = Number(m[1]), mo = Number(m[2]) - 1;
    if (d < 1 || d > 31 || mo < 0 || mo > 11) continue;
    if (m[3]) { const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]); add(`${y}-${pad(mo + 1)}-${pad(d)}`); }
    else add(withYear(d, mo, today));
  }
  // 14 mars, samedi 3 décembre 2026, 1er juin
  for (const m of src.matchAll(new RegExp(`\\b(\\d{1,2})\\s*(?:er)?\\s+(${MOIS_RE})\\.?(?:\\s+(\\d{4}))?`, "gi"))) {
    const d = Number(m[1]), mo = monthIndex(m[2]);
    if (mo < 0 || d < 1 || d > 31) continue;
    add(m[3] ? `${m[3]}-${pad(mo + 1)}-${pad(d)}` : withYear(d, mo, today));
  }
  return out.sort();
}

const hhmm = (h, m) => `${pad(Math.min(23, Number(h)))}:${pad(Math.min(59, Number(m || 0)))}`;
// « de 14h à 18h », « 14h30-17h », « de 9:00 à 12:00 », « à partir de 19h »
export function findTimes(text) {
  const src = String(text || "");
  const range = src.match(/(?:de\s+)?(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:à|a|-|–|jusqu'à|jusqu'a)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i);
  if (range) return { start: hhmm(range[1], range[2]), end: hhmm(range[3], range[4]) };
  const one = src.match(/(?:à partir de|a partir de|vers|à|a)\s+(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i);
  if (one) return { start: hhmm(one[1], one[2]), end: "" };
  return { start: "", end: "" };
}

// On cherche le nom de salle le plus long qui apparaît dans le texte
export function findRoom(text, rooms) {
  const t = fold(text);
  let best = null;
  for (const r of rooms || []) {
    const n = fold(r.name);
    if (n.length >= 4 && t.includes(n) && (!best || n.length > fold(best.name).length)) best = r;
  }
  return best;
}
export function findAssociation(text, associations) {
  const t = fold(text);
  let best = null;
  for (const a of associations || []) {
    const n = fold(a.name);
    if (n.length >= 3 && t.includes(n) && (!best || n.length > fold(best.name).length)) best = a;
  }
  return best;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const TEL = /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/;

export function parseMail(text, { rooms = [], associations = [], today = todayKey() } = {}) {
  const dates = findDates(text, today);
  const { start, end } = findTimes(text);
  const room = findRoom(text, rooms);
  const assoc = findAssociation(text, associations);
  const email = (String(text).match(EMAIL) || [""])[0];
  const tel = (String(text).match(TEL) || [""])[0].trim();
  const people = (String(text).match(/(\d{1,3})\s*(?:personnes|participants|pers\b|convives|invit[ée]s)/i) || [])[1] || "";
  const found = [];
  if (dates.length) found.push(dates.length === 1 ? "la date" : `${dates.length} dates`);
  if (start) found.push(end ? "les horaires" : "l'heure de début");
  if (room) found.push("la salle");
  if (assoc) found.push("l'association");
  if (email || tel) found.push("le contact");
  return {
    dates, start, end, roomId: room ? room.id : "", roomName: room ? room.name : "",
    associationId: assoc ? assoc.id : "", associationName: assoc ? assoc.name : "",
    contact: [email, tel].filter(Boolean).join(" · "), participants: people,
    schoolYear: dates.length ? schoolYearOf(dates[0]) : null, found,
  };
}

// Ce qu'on passe au formulaire de réservation
export function toBookingInitial(parsed, text) {
  const [first, ...rest] = parsed.dates;
  return {
    date: first || undefined, endDate: first || undefined, extraDates: rest,
    roomId: parsed.roomId || undefined, associationId: parsed.associationId || undefined,
    start: parsed.start || undefined, end: parsed.end || undefined,
    contact: parsed.contact || undefined, participants: parsed.participants || undefined,
    status: "a_confirmer",
    internalNote: `Mail reçu :\n${String(text || "").trim()}`,
  };
}
