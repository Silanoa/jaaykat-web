# Formes JSON supposées

`CONTRACTS.md` (hub `Silanoa/jaaykat`) fixe les routes et les enveloppes. Les champs imbriqués ne sont pas tous détaillés. La PWA valide ces formes avec zod. Une réponse différente s'affiche comme « Réponse inattendue », sans inventer un statut payé.

## Déjà dans le contrat

- Auth : `{ token, expiresAt, user, merchant }` et `GET /api/auth/me` → `{ user, merchant, session }`
- `user` : `{ id, phoneMasked }`
- `merchant` : `{ id, slug, displayName, category, qrUrl }`
- Facture : enveloppe `{ invoice }` avec le JSON du contrat (`status`, `amountXof`, `amountSats`, `bolt11`, `expiresAt`, `paidAt`, `label`, `channel`, `source`)
- `GET /api/public/invoices/:id` : `{ status, amountXof, expiresAt }` seulement. Le QR client vient de la réponse du POST.
- `GET /api/public/shops/:slug` : `{ name, category }`
- Devis : enveloppe `{ quote }` ; création : enveloppe `{ payout }` avec corps `{ quoteId }`

## Champs supposés, à confirmer côté API

`paymentHash` optionnel sur la facture marchand. S'il est absent, l'écran payé affiche la référence, pas une preuve inventée.

`GET /api/sales?from&to` → `{ items: [{ id, status, amountXof, amountSats?, createdAt, paidAt, label?, channel, source, payerNickname? }] }`

`GET /api/dashboard?range=today|7d|30d` :

```json
{
  "kpis": {
    "revenueXof": 0,
    "revenueDeltaPct": null,
    "salesCount": 0,
    "averageBasketXof": null,
    "conversionRate": null,
    "medianPaySeconds": null,
    "bestDay": null,
    "peakLabel": null
  },
  "heatmap": [{ "weekday": 0, "hour": 18, "salesCount": 1, "revenueXof": 2500 }],
  "loyal": [{ "nickname": "Fatou", "purchases": 2, "revenueXof": 5000 }],
  "advice": { "text": "…", "figures": null }
}
```

`weekday` : 0 = lundi … 6 = dimanche. `revenueDeltaPct` et `conversionRate` sont des ratios (0,2 = +20 %), pas des pourcentages déjà multipliés. Le front ne recalcule ni le chiffre ni le score.

`GET /api/score` :

```json
{
  "score": 71,
  "band": "B",
  "eligible": true,
  "computedAt": "2026-10-17T18:00:00.000Z",
  "progress": { "daysSinceFirst": 6, "salesCount": 12 },
  "components": [{ "key": "regularity", "value": 0.76 }],
  "actions": [{ "text": "…", "points": 6 }]
}
```

`components.key` : `regularity | growth | volume | loyalty | quality`. `value` entre 0 et 1. `progress` peut être `null`.

`GET /api/balance` → `{ balanceXof, balanceSats, lastPayouts: [{ id, amountXof, network, status, createdAt }] }`

`quote` : `{ id, amountXof, receivedXof, exchangeRate, fees, network, accountNumberMasked, accountName, expiresAt }`

`payout` : `{ id, status, amountXof, network, reference, failureReason? }`

`network` : `wave | orange | free | expresso`

`GET /api/system` → `{ env, platformBalances, lastCalls: [{ at, method, path, status, durationMs, correlationId }], seedHistory? }`

## Route absente du contrat

L'attestation `/s/:token` n'a pas de GET dans `CONTRACTS.md`. La page appelle :

`GET /api/public/shares/:token` → `{ shopName, score, band, period, salesCount, computedAt, expiresAt, status }`

`status` : `valid | expired | revoked`. Tant que l'API ne l'expose pas, l'écran affiche l'erreur, sans données inventées.

## Préférences locales, pas des routes

- `jk.session` = `{ token, expiresAt }` uniquement
- `jk.profile` : cache d'affichage `{ user, merchant }` pour l'en-tête hors ligne
- `jk.deviceId` : UUID anonyme du payeur
- `jk.quickAmounts` : quatre montants rapides sur l'appareil. Aucun PATCH marchand dans le contrat.
- `jk.cachedAt` : heure du dernier GET dashboard, ventes ou score reçu en ligne
