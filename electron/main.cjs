const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: "Planning des salles",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "editMenu" }, { role: "viewMenu" }]));
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
