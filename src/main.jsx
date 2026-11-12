import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initSync } from "./lib/planner/sync.js";

initSync()
  .catch(() => {})
  .finally(() => ReactDOM.createRoot(document.getElementById("root")).render(<App />));
