import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function Placeholder({ title }: { title: string }) {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>{title}</h1>
      <p>Implémenter selon SPEC.md — Jaaykat PWA</p>
      <p style={{ opacity: 0.6 }}>Sandbox · Code & Chain Dakar 2026</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<Placeholder title="E05 · Encaisser" />} />
        <Route path="/app/*" element={<Placeholder title="App marchand" />} />
        <Route path="/p/:slug" element={<Placeholder title="C1 · Paiement client" />} />
        <Route path="/s/:token" element={<Placeholder title="A1 · Attestation" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
