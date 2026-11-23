import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import DisplayStandalone from "./pages/DisplayStandalone.jsx";
import { initSync } from "./lib/planner/sync.js";

const root = () => ReactDOM.createRoot(document.getElementById("root"));

// La fenêtre de la télévision du hall : lecture seule, pas de synchronisation
if (window.location.hash === "#affichage") {
  root().render(<DisplayStandalone />);
} else {
  initSync()
    .catch(() => {})
    .finally(() => root().render(<App />));
}
