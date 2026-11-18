export const ENTITIES = ["Room", "Association", "Booking", "RecurringBooking", "BookingTemplate", "Closure", "DayNote", "Invoice", "OrganisationSettings", "ActivityLog", "Stage", "Vacation"];
const PREFIX = "salleplan.db.";

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function loadAll() {
  const out = {};
  for (const e of ENTITIES) {
    try {
      const raw = window.localStorage.getItem(PREFIX + e);
      const parsed = raw ? JSON.parse(raw) : [];
      out[e] = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      out[e] = [];
    }
  }
  return out;
}
let saveHook = null;
export const setSaveHook = (fn) => { saveHook = fn; };
export function saveEntity(name, list) {
  window.localStorage.setItem(PREFIX + name, JSON.stringify(list));
  if (saveHook) saveHook(name);
}
export const rawSet = (name, list) => window.localStorage.setItem(PREFIX + name, JSON.stringify(list));

// Écrit plusieurs entités d'un bloc. Si une écriture échoue (mémoire pleine, navigation privée),
// on remet les valeurs précédentes : mieux vaut ne rien changer qu'une base à moitié écrite.
export function saveAll(entries) {
  const done = [];
  try {
    for (const [name, list] of entries) {
      done.push([name, window.localStorage.getItem(PREFIX + name)]);
      window.localStorage.setItem(PREFIX + name, JSON.stringify(list));
    }
    if (saveHook) for (const [name] of entries) saveHook(name);
    return { ok: true };
  } catch (err) {
    for (const [name, prev] of done) {
      try { if (prev === null) window.localStorage.removeItem(PREFIX + name); else window.localStorage.setItem(PREFIX + name, prev); } catch (e) { /* on ne peut rien de plus */ }
    }
    return { ok: false, error: err && err.name === "QuotaExceededError" ? "La mémoire de l'application est pleine. Archivez une ancienne année (Réglages › Archives) puis réessayez." : "Enregistrement impossible : " + ((err && err.message) || "erreur inconnue") };
  }
}
export function exportJson(data) {
  return JSON.stringify({ app: "planning-des-salles", version: 2, exportedAt: new Date().toISOString(), data }, null, 2);
}
export function parseBackup(text) {
  const obj = JSON.parse(text);
  if (!obj || obj.app !== "planning-des-salles" || !obj.data) throw new Error("format");
  const out = {};
  for (const e of ENTITIES) out[e] = Array.isArray(obj.data[e]) ? obj.data[e] : [];
  return out;
}
