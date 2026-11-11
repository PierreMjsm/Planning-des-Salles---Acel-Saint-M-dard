const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require("electron");
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
ipcMain.handle("fs:savePdf", safe(async (_e, name) => {
  const r = await dialog.showSaveDialog(win, { title: "Enregistrer en PDF", defaultPath: (name || "document") + ".pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  const pdf = await win.webContents.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(r.filePath, pdf);
  return { ok: true, path: r.filePath };
}));

ipcMain.handle("fs:listBackups", safe(() => ({ ok: true, list: store.listBackups(currentDir()) })));
ipcMain.handle("fs:readBackup", safe((_e, name) => ({ ok: true, text: store.readBackup(currentDir(), name) })));
ipcMain.handle("fs:presence", safe((_e, actor, id) => ({ ok: true, others: store.presence(currentDir(), actor, id) })));

// ---- Archivage des PDF (relevés de frais) ----
const archiveDir = () => loadConfig().archiveDir || path.join(app.getPath("documents"), "Planning des salles", "Relevés de frais");
const cleanName = (n) => String(n || "document").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
ipcMain.handle("fs:getArchiveDir", safe(() => ({ ok: true, dir: archiveDir() })));
ipcMain.handle("fs:chooseArchiveDir", safe(async () => {
  const r = await dialog.showOpenDialog(win, { title: "Choisir le dossier d'archivage des relevés (PDF)", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  saveConfig({ ...loadConfig(), archiveDir: r.filePaths[0] });
  return { ok: true, dir: r.filePaths[0] };
}));
ipcMain.handle("fs:archivePdf", safe(async (_e, name, sub) => {
  const dir = path.join(archiveDir(), cleanName(sub || ""));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, cleanName(name) + ".pdf");
  const pdf = await win.webContents.printToPDF({ pageSize: "A4", printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(file, pdf);
  return { ok: true, path: file };
}));
ipcMain.handle("fs:archiveImage", safe((_e, name, dataUrl, sub) => {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return { ok: false, error: "Image invalide" };
  const dir = path.join(archiveDir(), cleanName(sub || ""));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, cleanName(name) + (m[1] === "png" ? ".png" : ".jpg"));
  fs.writeFileSync(file, Buffer.from(m[2], "base64"));
  return { ok: true, path: file };
}));
ipcMain.handle("fs:revealFile", safe((_e, file) => { if (file && fs.existsSync(file)) shell.showItemInFolder(file); else { fs.mkdirSync(archiveDir(), { recursive: true }); shell.openPath(archiveDir()); } return { ok: true }; }));
ipcMain.handle("fs:openArchiveDir", safe(async () => { fs.mkdirSync(archiveDir(), { recursive: true }); await shell.openPath(archiveDir()); return { ok: true }; }));

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
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
