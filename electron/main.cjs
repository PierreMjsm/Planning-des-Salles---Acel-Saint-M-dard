const { app, BrowserWindow, screen, Menu, shell, ipcMain, dialog, powerSaveBlocker, powerMonitor } = require("electron");
const path = require("path");
const fs = require("fs");
const store = require("./datastore.cjs");

let win = null;
const configPath = () => path.join(app.getPath("userData"), "config.json");
function loadConfig() { try { return JSON.parse(fs.readFileSync(configPath(), "utf8")); } catch (e) { return {}; } }
function saveConfig(c) { fs.mkdirSync(path.dirname(configPath()), { recursive: true }); fs.writeFileSync(configPath(), JSON.stringify(c)); }
const localDir = () => path.join(app.getPath("userData"), "donnees");
const currentDir = () => loadConfig().dataDir || localDir();
// Première ouverture sur un autre PC : si le logiciel est lancé depuis un dossier qui contient déjà
// le fichier de données (ex. dossier Drive partagé), on utilise automatiquement ce dossier.
function autoDetectSharedFolder() {
  try {
    if (loadConfig().dataDir) return;
    const bases = [process.env.PORTABLE_EXECUTABLE_DIR, path.dirname(process.execPath), path.dirname(path.dirname(process.execPath))].filter(Boolean);
    for (const b of bases) for (const d of [b, path.join(b, "donnees"), path.join(b, "Donnees")]) {
      if (fs.existsSync(path.join(d, store.FILE))) { saveConfig({ ...loadConfig(), dataDir: d }); return; }
    }
  } catch (e) { /* ignoré */ }
}
autoDetectSharedFolder();
const safe = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; } };

ipcMain.handle("fs:getConfig", safe(() => { const c = loadConfig(); return { ok: true, dataDir: c.dataDir || "", localDir: localDir(), shared: !!c.dataDir }; }));
ipcMain.handle("fs:chooseFolder", safe(async () => {
  const r = await dialog.showOpenDialog(win, { title: "Choisir le dossier des données partagées", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  const prev = loadConfig().dataDir || "";
  saveConfig({ ...loadConfig(), dataDir: r.filePaths[0] });
  return { ok: true, dataDir: r.filePaths[0], prevDir: prev };
}));
ipcMain.handle("fs:setFolder", safe((_e, dir) => { const c = loadConfig(); if (dir) c.dataDir = dir; else delete c.dataDir; saveConfig(c); return { ok: true }; }));
ipcMain.handle("fs:useDefaultFolder", safe(() => { const c = loadConfig(); delete c.dataDir; saveConfig(c); return { ok: true }; }));
ipcMain.handle("fs:readData", safe(() => ({ ok: true, ...store.readData(currentDir()) })));
ipcMain.handle("fs:stat", safe(() => ({ ok: true, ...store.stat(currentDir()) })));
ipcMain.handle("fs:writeData", safe((_e, payload) => store.writeData(currentDir(), payload)));
ipcMain.handle("fs:backup", safe((_e, data) => {
  const p = store.backup(currentDir(), data);
  if (loadConfig().dataDir) { try { store.backup(localDir(), data); } catch (e) { /* copie locale facultative */ } }
  return { ok: true, path: p };
}));
ipcMain.handle("fs:openFolder", safe(async () => { fs.mkdirSync(currentDir(), { recursive: true }); await shell.openPath(currentDir()); return { ok: true }; }));
// Impression avec la boîte de dialogue habituelle, en proposant le recto seul (fiche du jour)
ipcMain.handle("fs:print", safe((_e, opts) => new Promise((resolve) => {
  const o = { silent: false, printBackground: true };
  if (opts && opts.simplex) o.duplexMode = "simplex";
  win.webContents.print(o, (ok, reason) => resolve({ ok: !!ok, canceled: !ok, reason: reason || "" }));
})));
ipcMain.handle("fs:savePdf", safe(async (_e, name) => {
  const r = await dialog.showSaveDialog(win, { title: "Enregistrer en PDF", defaultPath: (name || "document") + ".pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  const pdf = await win.webContents.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(r.filePath, pdf);
  return { ok: true, path: r.filePath };
}));

ipcMain.handle("fs:writeArchive", safe((_e, year, data) => ({ ok: true, ...store.writeArchive(currentDir(), year, data) })));
ipcMain.handle("fs:listArchives", safe(() => ({ ok: true, list: store.listArchives(currentDir()) })));
ipcMain.handle("fs:readArchive", safe((_e, name) => ({ ok: true, text: store.readArchive(currentDir(), name) })));
ipcMain.handle("fs:openArchives", safe(async () => { const d = path.join(currentDir(), store.archiveDirName); fs.mkdirSync(d, { recursive: true }); await shell.openPath(d); return { ok: true }; }));
ipcMain.handle("fs:listBackups", safe(() => ({ ok: true, list: store.listBackups(currentDir()) })));
ipcMain.handle("fs:readBackup", safe((_e, name) => ({ ok: true, text: store.readBackup(currentDir(), name) })));
ipcMain.handle("fs:presence", safe((_e, actor, id) => ({ ok: true, others: store.presence(currentDir(), actor, id) })));

// ---- Archivage des PDF (relevés de frais) ----
const archiveDir = () => loadConfig().archiveDir || path.join(app.getPath("documents"), "Planning des salles", "Relevés de frais");
const cleanName = (n) => String(n || "document").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
// Sous-dossier éventuellement à plusieurs niveaux (« 2026/Copropriétés ») : chaque
// segment est nettoyé séparément, et rien ne peut remonter hors du dossier d'archivage.
const cleanSub = (sub) => String(sub || "").split("/").map((p) => p.replace(/[\\/:*?"<>|]+/g, "-").replace(/^[.\s]+|[.\s]+$/g, "").slice(0, 120)).filter(Boolean);
ipcMain.handle("fs:getArchiveDir", safe(() => ({ ok: true, dir: archiveDir() })));
ipcMain.handle("fs:chooseArchiveDir", safe(async () => {
  const r = await dialog.showOpenDialog(win, { title: "Choisir le dossier d'archivage des relevés (PDF)", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  saveConfig({ ...loadConfig(), archiveDir: r.filePaths[0] });
  return { ok: true, dir: r.filePaths[0] };
}));
ipcMain.handle("fs:archivePdf", safe(async (_e, name, sub) => {
  const dir = path.join(archiveDir(), ...cleanSub(sub));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, cleanName(name) + ".pdf");
  const pdf = await win.webContents.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(file, pdf);
  return { ok: true, path: file };
}));
ipcMain.handle("fs:archiveImage", safe((_e, name, dataUrl, sub) => {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return { ok: false, error: "Image invalide" };
  const dir = path.join(archiveDir(), ...cleanSub(sub));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, cleanName(name) + (m[1] === "png" ? ".png" : ".jpg"));
  fs.writeFileSync(file, Buffer.from(m[2], "base64"));
  return { ok: true, path: file };
}));
ipcMain.handle("fs:revealFile", safe((_e, file) => { if (file && fs.existsSync(file)) shell.showItemInFolder(file); else { fs.mkdirSync(archiveDir(), { recursive: true }); shell.openPath(archiveDir()); } return { ok: true }; }));
ipcMain.handle("fs:openArchiveDir", safe(async () => { fs.mkdirSync(archiveDir(), { recursive: true }); await shell.openPath(archiveDir()); return { ok: true }; }));

// ---- Écran d'affichage : une seconde fenêtre, posée sur l'écran de la télévision
let displayWin = null;
function externalDisplay() {
  const all = screen.getAllDisplays();
  if (all.length < 2) return null;
  const here = win ? screen.getDisplayMatching(win.getBounds()) : screen.getPrimaryDisplay();
  return all.find((d) => d.id !== here.id) || null;
}
// ---- Publication de l'affichage sur le réseau local
const web = require("./display-server.cjs");
const distDir = () => path.join(__dirname, "..", "dist");
ipcMain.handle("net:status", safe(() => web.status()));
ipcMain.handle("net:start", safe(async () => await web.start(distDir())));
ipcMain.handle("net:stop", safe(() => web.stop()));
ipcMain.handle("net:push", safe((_e, data) => { web.setSnapshot(data); return { ok: true }; }));

ipcMain.handle("display:list", safe(() => ({ ok: true, count: screen.getAllDisplays().length, external: !!externalDisplay() })));
// Tant que la télévision du hall affiche quelque chose, l'ordinateur ne doit ni
// s'endormir ni éteindre ses écrans. Le blocage est levé dès que l'affichage est
// fermé : la mise en veille habituelle reprend alors son cours.
let awakeId = null;
function keepAwake(on) {
  try {
    if (on && awakeId === null) awakeId = powerSaveBlocker.start("prevent-display-sleep");
    if (!on && awakeId !== null) { if (powerSaveBlocker.isStarted(awakeId)) powerSaveBlocker.stop(awakeId); awakeId = null; }
  } catch (e) { /* sans effet sur le reste du logiciel */ }
}
ipcMain.handle("display:close", safe(() => { if (displayWin && !displayWin.isDestroyed()) displayWin.close(); displayWin = null; keepAwake(false); return { ok: true }; }));
ipcMain.handle("display:open", safe(() => {
  const d = externalDisplay();
  if (!d) return { ok: false, error: "Aucun second écran détecté" };
  if (displayWin && !displayWin.isDestroyed()) { displayWin.show(); displayWin.focus(); return { ok: true, already: true }; }
  const { x, y, width, height } = d.bounds;
  displayWin = new BrowserWindow({
    x, y, width, height, fullscreen: true, frame: false, backgroundColor: "#15120E",
    title: "Affichage du hall", icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, "preload.cjs") },
  });
  displayWin.loadFile(path.join(__dirname, "..", "dist", "index.html"), { hash: "affichage" });
  keepAwake(true);
  displayWin.on("closed", () => { displayWin = null; keepAwake(false); });
  displayWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // la fenêtre d'affichage ne doit pas garder l'application ouverte à elle seule
  displayWin.on("close", () => { displayWin = null; keepAwake(false); });
  return { ok: true };
}));

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: "Planning des salles",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, "preload.cjs") },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "editMenu" }, { role: "viewMenu" }]));
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) { event.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith("file://")) shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(() => {
  // Si la mise en veille a tout de même eu lieu (couvercle refermé, coupure),
  // on relit les données au réveil pour ne pas rester sur un écran périmé.
  const refresh = () => { if (displayWin && !displayWin.isDestroyed()) displayWin.webContents.reload(); };
  try { powerMonitor.on("resume", refresh); powerMonitor.on("unlock-screen", refresh); } catch (e) { /* non disponible sur ce système */ }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
// fermer la fenêtre principale ferme l'affichage du hall
app.on("before-quit", () => { keepAwake(false); try { web.stop(); } catch (e) {} if (displayWin && !displayWin.isDestroyed()) displayWin.destroy(); });
