# AGENTS.md — jaaykat-web

## Avant tout code

1. Lire `docs/superpowers/specs/2026-10-17-jaaykat-web-design.md`
2. Suivre `docs/superpowers/plans/2026-10-17-jaaykat-web-implementation.md`
3. TDD pour logique non triviale (hooks, formatters, validation)
4. Exécution : `executing-plans` ou `subagent-driven-development`

## Règles produit

- Mobile = PWA installable (pas d’app native)
- Aucun secret `VITE_*`
- Aucun appel Bitnob direct
- Statuts paiement = réponse API uniquement
- POST invoices/payouts : jamais en cache hors ligne

## Interdits

- Commentaires filler
- Cards / chrome UI hors brief design du projet
- Recalcul métier (score, sats) côté client
