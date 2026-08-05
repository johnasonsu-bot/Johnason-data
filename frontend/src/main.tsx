import "@ant-design/v5-patch-for-react-19";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { applyMedataCssVariables } from "./design-system";
import "antd/dist/reset.css";
import "./styles/index.css";

applyMedataCssVariables();

const CHUNK_RELOAD_KEY = "medata-chunk-reload-once";

function reloadForStaleChunk() {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
}

function isChunkLoadFailure(value: unknown) {
  const message =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "message" in value
        ? String((value as { message?: unknown }).message || "")
        : "";

  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadForStaleChunk();
});

window.addEventListener("error", (event) => {
  if (isChunkLoadFailure(event.error)) {
    reloadForStaleChunk();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadFailure(event.reason)) {
    event.preventDefault();
    reloadForStaleChunk();
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

