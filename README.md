# jaaykat-web

PWA Jaaykat (marchand + page paiement client). Mobile = installation écran d’accueil, pas de store.

## Docs

- [AGENTS.md](./AGENTS.md)
- [Design](./docs/superpowers/specs/2026-10-17-jaaykat-web-design.md)
- [Plan](./docs/superpowers/plans/2026-10-17-jaaykat-web-implementation.md)

## Run

```bash
pnpm install
pnpm dev
```

Proxy `/api` → `http://localhost:3000`.  
Build démo : `pnpm build` puis copier `dist/` vers `jaaykat-api/public/`.
