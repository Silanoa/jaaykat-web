# jaaykat-web

PWA Jaaykat (web + mobile installable) — React + Vite.

Pas d’app native : le « mobile » = PWA `display: standalone` sur l’écran d’accueil.

## Spec

→ [SPEC.md](./SPEC.md) (écrans E*/C*/A1, PWA, polling)

## Dev

```bash
pnpm install
pnpm dev
# proxy /api → http://localhost:3000 (jaaykat-api)
```

## Build pour la démo

```bash
pnpm build
# Copier dist/ vers jaaykat-api/public/
```

## Repos

- Backend : [jaaykat-api](https://github.com/Silanoa/jaaykat-api)
- SDK : [bitnob-lite](https://github.com/Silanoa/bitnob-lite)
