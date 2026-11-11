// Synchronisation des données avec un fichier (application Windows) : dossier local ou dossier partagé.
// Dans un navigateur (sans l'application), tout reste dans localStorage et rien n'est synchronisé.
import { ENTITIES, loadAll, rawSet, setSaveHook } from "./store.js";

const K_REV = "salleplan.sync.rev";
const K_DIRTY = "salleplan.sync.dirty";
const K_STAMP = "salleplan.sync.stamp";
const K_BACKUP = "salleplan.sync.backupDay";
const api = () => (typeof window !== "undefined" && window.salleplanFS) || null;
const ls = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) { /* ignoré */ } },
  del: (k) => { try { window.localStorage.removeItem(k); } catch (e) { /* ignoré */ } },
};
const actor = () => ls.get("salleplan.actor") || "";

let state = { enabled: false, status: "local", dir: "", shared: false, savedBy: "", savedAt: "", remoteBy: "", error: "", others: [], copies: [] };
let baseStamp = "";
let baseRev = 0, timer = null, polling = null, busy = false, presenceTimer = null;
const PID = Math.random().toString(36).slice(2, 10);
async function beat() { try { const r = await api().presence(actor() || "?", PID); if (r && r.ok) { const k = (r.others || []).join(","); if (k !== (state.others || []).join(",")) set({ others: r.others || [] }); } } catch (e) { /* ignoré */ } }
const subs = new Set(), reloadSubs = new Set();
const emit = () => subs.forEach((f) => f({ ...state }));
const set = (patch) => { state = { ...state, ...patch }; emit(); };
export const getSyncState = () => ({ ...state });
export const subscribeSync = (f) => { subs.add(f); return () => subs.delete(f); };
export const onRemoteReload = (f) => { reloadSubs.add(f); return () => reloadSubs.delete(f); };

function applyRemote(r) {
  for (const e of ENTITIES) rawSet(e, Array.isArray(r.data && r.data[e]) ? r.data[e] : []);
  baseRev = r.rev || 0; baseStamp = r.savedAt || "";
  ls.set(K_REV, String(baseRev)); ls.set(K_STAMP, baseStamp);
  ls.del(K_DIRTY);
  set({ status: "saved", savedBy: r.savedBy || "", savedAt: r.savedAt || "", remoteBy: "" });
}

async function dailyBackup(data) {
  const day = new Date().toISOString().slice(0, 10);
  if (ls.get(K_BACKUP) === day) return;
  const r = await api().backup({ app: "planning-des-salles", exportedAt: new Date().toISOString(), data });
  if (r && r.ok) ls.set(K_BACKUP, day);
}

let paused = false; // pendant le choix d'un autre dossier, on n'écrit rien (sinon on écraserait le planning de l'autre ordinateur)
async function push(force) {
  const a = api(); if (!a) return;
  if (paused && !force) return;
  if (busy) { schedule(); return; }
  busy = true;
  try {
    const data = loadAll();
    const before = JSON.stringify(data);
    const res = await a.writeData({ data, baseRev, baseStamp, actor: actor(), force: !!force });
    if (res.ok) {
      baseRev = res.rev; baseStamp = res.savedAt || ""; ls.set(K_REV, String(baseRev)); ls.set(K_STAMP, baseStamp);
      // une modification faite pendant l'écriture reste « à enregistrer »
      if (JSON.stringify(loadAll()) === before) ls.del(K_DIRTY); else schedule();
      set({ status: "saved", savedAt: new Date().toISOString(), savedBy: actor(), error: "" });
      dailyBackup(data).catch(() => {});
    } else if (res.conflict) {
      set({ status: "conflict" });
    } else {
      set({ status: "error", error: res.error || "Écriture impossible" });
    }
  } catch (e) {
    set({ status: "error", error: String((e && e.message) || e) });
  } finally { busy = false; }
}
function schedule() {
  if (!api()) return;
  ls.set(K_DIRTY, "1");
  if (state.status !== "conflict") set({ status: "saving" });
  clearTimeout(timer);
  timer = setTimeout(() => { if (state.status !== "conflict") push(false); }, 700);
}

async function poll() {
  const a = api(); if (!a || paused || busy || state.status === "saving" || state.status === "conflict") return;
  const st = await a.stat();
  if (!st.ok) { set({ status: "error", error: st.error || "Dossier inaccessible" }); return; }
  const copies = st.copies || [];
  if (copies.join("|") !== (state.copies || []).join("|")) set({ copies });
  const changed = st.exists && (st.rev !== baseRev || (!!baseStamp && !!st.savedAt && st.savedAt !== baseStamp));
  if (changed) {
    if (ls.get(K_DIRTY)) { set({ status: "conflict", remoteBy: st.savedBy }); return; }
    const r = await a.readData();
    if (r.ok && r.exists) { applyRemote(r); set({ remoteBy: st.savedBy }); reloadSubs.forEach((f) => f(st.savedBy)); }
  } else {
    if (state.status === "error") set({ status: "saved", error: "" });
    // une écriture avait échoué (dossier momentanément indisponible) : on réessaie
    if (ls.get(K_DIRTY)) push(false);
  }
}

export async function initSync() {
  const a = api();
  setSaveHook(schedule);
  if (!a) return;
  set({ enabled: true, status: "saving" });
  try {
    const cfg = await a.getConfig();
    set({ dir: cfg.dataDir || cfg.localDir, shared: !!cfg.shared });
    const r = await a.readData();
    if (!r.ok) { set({ status: "error", error: r.error || "Dossier inaccessible" }); }
    else if (!r.exists) { baseRev = 0; await push(true); }
    else if (ls.get(K_DIRTY)) {
      baseRev = Number(ls.get(K_REV) || 0); baseStamp = ls.get(K_STAMP) || "";
      if (r.rev === baseRev && (!baseStamp || !r.savedAt || r.savedAt === baseStamp)) await push(false); else { set({ status: "conflict", remoteBy: r.savedBy }); }
    } else { applyRemote(r); }
  } catch (e) { set({ status: "error", error: String((e && e.message) || e) }); }
  if (!polling) polling = setInterval(() => poll().catch(() => {}), 5000);
  if (!presenceTimer && api().presence) { presenceTimer = setInterval(beat, 8000); beat(); }
  window.addEventListener("pagehide", () => { if (ls.get(K_DIRTY) && state.status !== "conflict") push(false); });
}

// --- actions proposées à l'utilisateur ---
export async function reloadRemote() {
  const r = await api().readData();
  if (r.ok && r.exists) { applyRemote(r); reloadSubs.forEach((f) => f("")); }
}
export async function overwriteRemote() {
  const st = await api().stat();
  baseRev = st.rev || 0; baseStamp = st.savedAt || "";
  await push(true);
}
export async function chooseFolder() {
  const a = api(); paused = true; const c = await a.chooseFolder();
  if (!c.ok) { paused = false; return { canceled: true }; }
  const r = await a.readData();
  return { dir: c.dataDir, prevDir: c.prevDir || "", exists: !!r.exists, savedBy: r.savedBy, savedAt: r.savedAt };
}
export async function adoptFolder(useRemote) {
  const a = api(); paused = false;
  if (useRemote) { const r = await a.readData(); if (r.ok && r.exists) applyRemote(r); }
  else { const st = await a.stat(); baseRev = st.exists ? st.rev : 0; baseStamp = (st.exists && st.savedAt) || ""; await push(true); }
  window.location.reload();
}
export async function revertFolder(prevDir) { await api().setFolder(prevDir || ""); paused = false; }
export async function useLocalFolder() { await api().useDefaultFolder(); window.location.reload(); }
export const openFolder = () => api() && api().openFolder();
export const canSavePdf = () => !!(api() && api().savePdf);
export const savePdf = (name) => api().savePdf(name);

export const canArchive = () => !!(api() && api().archivePdf);
export const getArchiveDir = async () => (canArchive() ? (await api().getArchiveDir()).dir || "" : "");
export const chooseArchiveDir = () => api().chooseArchiveDir();
export const archivePdf = (name, sub) => api().archivePdf(name, sub);
export const revealFile = (f) => api().revealFile(f);
export const openArchiveDir = () => api().openArchiveDir();

export const canListBackups = () => !!(api() && api().listBackups);
export const listBackups = async () => { const r = await api().listBackups(); return (r && r.list) || []; };
export const readBackup = async (name) => { const r = await api().readBackup(name); if (!r || !r.ok) throw new Error((r && r.error) || "Lecture impossible"); return r.text; };
export const archiveImage = (name, dataUrl, sub) => (api() && api().archiveImage ? api().archiveImage(name, dataUrl, sub) : Promise.resolve({ ok: false }));
