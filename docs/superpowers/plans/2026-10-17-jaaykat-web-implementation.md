# jaaykat-web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. TDD pour client API, validation, formatters.

**Goal:** PWA marchand + pages client/attestation, installable, branchée sur jaaykat-api.

**Architecture:** SPA React ; polling 2 s / 10 s ; session Bearer `jk.session` ; Workbox ; build copié dans `jaaykat-api/public`.

**Tech Stack:** Vite, React 19, React Router, TanStack Query, Zustand, Tailwind, vite-plugin-pwa, zod, qrcode

## Global Constraints

- Aucun secret front
- Aucun appel Bitnob
- Pas de cache/replay POST invoices/payouts hors ligne
- XOF d’abord ; bandeau sandbox
- Pas de commentaires filler

---

### Task 1: Shell + router + tab bar

- [ ] Routes `/app/*`, `/p/:slug`, `/s/:token`
- [ ] Proxy Vite `/api`
- [ ] Commit

### Task 2: Session client HTTP

- [ ] Bearer depuis `jk.session` ; 401 → login
- [ ] Idempotency-Key sur POST concernés
- [ ] Commit

### Task 3: P0 encaissement

- [ ] E04 login, E05 montant, E06 QR + poll, E07 payé (son/vibreur)
- [ ] Checkpoint 20h00
- [ ] Commit

### Task 4: Inscription + PWA install

- [ ] E02/E03 register, E01b install, manifest/SW
- [ ] Commit

### Task 5: Client C1–C3 + E08 QR universel

- [ ] Page `/p/:slug` + reçu
- [ ] Commit

### Task 6: Ventes + dashboard + score

- [ ] E09, E11, E12 + états vide/chargement/erreur/hors ligne
- [ ] Commit

### Task 7: Payouts E15–E18 (si API prête)

- [ ] Formulaire, devis, suivi
- [ ] Commit

### Task 8: Polish démo

- [ ] Icônes, Lighthouse PWA, affiche A6, sync `dist` → api/public
- [ ] Commit

Design : `docs/superpowers/specs/2026-10-17-jaaykat-web-design.md`
