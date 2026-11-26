// Publie l'écran d'affichage sur le réseau local : la télévision du hall ouvre
// l'adresse dans son navigateur, ou un PC l'ouvre dans Chrome et la caste sur le
// Chromecast. Rien ne sort du réseau de la maison, et la page ne contient que
// l'horaire du jour : ni note interne, ni contact, ni montant.
const http = require("node:http");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 8787;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webmanifest": "application/manifest+json" };

let server = null;
let snapshot = { at: 0, data: null };

// Les adresses du réseau local, pour les montrer à l'utilisateur
function addresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces() || {})) {
    for (const n of list || []) {
      if (n.family === "IPv4" && !n.internal) out.push(`http://${n.address}:${PORT}/affichage`);
    }
  }
  return out;
}

const isOn = () => !!server && server.listening;
const setSnapshot = (data) => { snapshot = { at: Date.now(), data: data || null }; };

function start(distDir) {
  if (isOn()) return { ok: true, urls: addresses(), already: true };
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://x");
      let p = decodeURIComponent(url.pathname);
      res.setHeader("Cache-Control", "no-store");
      if (p === "/data.json") {
        res.writeHead(200, { "Content-Type": TYPES[".json"] });
        return res.end(JSON.stringify(snapshot));
      }
      // la racine mène à l'affichage : une page ouverte depuis la télévision ne doit
      // jamais démarrer le logiciel complet
      if (p === "/" || p === "/index.html") { res.writeHead(302, { Location: "/affichage" }); return res.end(); }
      if (p === "/affichage" || p === "/affichage/") p = "/index.html";
      // on ne sert que le dossier compilé, jamais au-dessus
      const file = path.normalize(path.join(distDir, p));
      if (!file.startsWith(path.normalize(distDir))) { res.writeHead(403); return res.end("Interdit"); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Page introuvable"); }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
        res.end(buf);
      });
    });
    server.on("error", (e) => { server = null; resolve({ ok: false, error: e.code === "EADDRINUSE" ? `Le port ${PORT} est déjà utilisé` : e.message }); });
    server.listen(PORT, "0.0.0.0", () => resolve({ ok: true, urls: addresses() }));
  });
}

function stop() {
  if (server) { try { server.close(); } catch (e) {} server = null; }
  return { ok: true };
}

module.exports = { start, stop, isOn, setSnapshot, addresses, status: () => ({ ok: true, on: isOn(), urls: isOn() ? addresses() : [], at: snapshot.at }) };
