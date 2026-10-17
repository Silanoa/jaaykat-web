import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function Shell({ title }: { title: string }) {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>{title}</h1>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<Shell title="Encaisser" />} />
        <Route path="/app/*" element={<Shell title="Jaaykat" />} />
        <Route path="/p/:slug" element={<Shell title="Paiement" />} />
        <Route path="/s/:token" element={<Shell title="Attestation" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
