import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { bindInstallPrompt } from "./lib/install";
import { useSession } from "./stores/session";
import "./styles/tokens.css";

bindInstallPrompt();
useSession.getState().hydrate();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
