// Stockage des données dans un fichier JSON (dossier local ou dossier partagé OneDrive / Drive / Dropbox).
const fs = require("fs");
const path = require("path");

const FILE = "planning-des-salles-donnees.json";
const dataFile = (dir) => path.join(dir, FILE);

function readData(dir) {
  const f = dataFile(dir);
  if (!fs.existsSync(f)) return { exists: false };
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return { exists: true, rev: j.rev || 0, savedBy: j.savedBy || "", savedAt: j.savedAt || "", data: j.data || {} };
}

function stat(dir) {
  const f = dataFile(dir);
  if (!fs.existsSync(f)) return { exists: false };
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return { exists: true, rev: j.rev || 0, savedBy: j.savedBy || "", savedAt: j.savedAt || "" };
}

// Écrit seulement si personne d'autre n'a modifié le fichier depuis baseRev (sauf force)
function writeData(dir, { data, baseRev, actor, force }) {
  fs.mkdirSync(dir, { recursive: true });
  const f = dataFile(dir);
  let cur = 0;
  if (fs.existsSync(f)) { try { cur = JSON.parse(fs.readFileSync(f, "utf8")).rev || 0; } catch (e) { cur = 0; } }
  if (!force && cur !== (baseRev || 0)) return { ok: false, conflict: true, rev: cur };
  const rev = cur + 1;
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ app: "planning-des-salles", rev, savedBy: actor || "", savedAt: new Date().toISOString(), data }));
  fs.renameSync(tmp, f);
  return { ok: true, rev };
}

// Copie datée (une par jour), 30 jours conservés
function backup(dir, data, keep = 30) {
  const bdir = path.join(dir, "sauvegardes");
  fs.mkdirSync(bdir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(bdir, `planning-${day}.json`), JSON.stringify(data));
  const files = fs.readdirSync(bdir).filter((n) => /^planning-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  while (files.length > keep) fs.unlinkSync(path.join(bdir, files.shift()));
  return path.join(bdir, `planning-${day}.json`);
}

function listBackups(dir) {
  const bdir = path.join(dir, "sauvegardes");
  if (!fs.existsSync(bdir)) return [];
  return fs.readdirSync(bdir).filter((n) => /^planning-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse().map((n) => ({ name: n, day: n.slice(9, 19), size: fs.statSync(path.join(bdir, n)).size }));
}
function readBackup(dir, name) {
  if (!/^planning-\d{4}-\d{2}-\d{2}\.json$/.test(name || "")) throw new Error("Nom de sauvegarde invalide");
  return fs.readFileSync(path.join(dir, "sauvegardes", name), "utf8");
}
// Présence : qui a le logiciel ouvert (un petit fichier par poste, périmé après 45 s)
function presence(dir, actor, id) {
  const pdir = path.join(dir, "presence");
  fs.mkdirSync(pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, `${String(id).replace(/[^\w-]/g, "")}.json`), JSON.stringify({ actor, at: Date.now() }));
  const others = [];
  for (const n of fs.readdirSync(pdir)) {
    try { const j = JSON.parse(fs.readFileSync(path.join(pdir, n), "utf8")); if (n !== `${String(id).replace(/[^\w-]/g, "")}.json`) { if (Date.now() - j.at < 30000) { if (j.actor && j.actor !== "?") others.push(j.actor); } else if (Date.now() - j.at > 600000) fs.unlinkSync(path.join(pdir, n)); } } catch (e) { /* ignoré */ }
  }
  return [...new Set(others)];
}

module.exports = { listBackups, readBackup, presence, FILE, dataFile, readData, stat, writeData, backup };
