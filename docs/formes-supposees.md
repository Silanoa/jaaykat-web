# Formes JSON supposées

`CONTRACTS.md` (hub `Silanoa/jaaykat`) fixe les routes et les enveloppes. Les champs imbriqués ne sont pas tous détaillés. La PWA valide ces formes avec zod. Une réponse différente s'affiche comme « Réponse inattendue », sans inventer un statut payé.

## Déjà dans le contrat

- Auth : `{ token, expiresAt, user, merchant }` et `GET /api/auth/me` → `{ user, merchant, session }`
- `user` : `{ id, phoneMasked }`
- `merchant` : `{ id, slug, displayName, category, qrUrl }`
- Facture : enveloppe `{ invoice }` avec le JSON du contrat (`status`, `amountXof`, `amountSats`, `bolt11`, `expiresAt`, `paidAt`, `label`, `channel`, `source`)
- `GET /api/public/invoices/:id` : au minimum `{ status, amountXof, expiresAt }`. Le QR Lightning client vient de la réponse du POST quand `bolt11` est présent.
- `GET /api/public/shops/:slug` : `{ name, category }`
- Devis : enveloppe `{ quote }` ; création : enveloppe `{ payout }` avec corps `{ quoteId }`

## Paiement démo manuel

Mode API `DEMO_PAY_MODE=manual`. Le front ne calcule pas le statut : il affiche `paid` seulement si un GET le renvoie, et il continue de poller toutes les 2 s.

La facture marchand (`POST` et `GET /api/invoices`) et la facture publique créée (`POST /api/public/invoices`, enveloppe `{ invoice }`) ajoutent :

```json
{
  "demoPayment": true,
  "bolt11": null,
  "payUrl": "https://exemple/p/awa-beaute?facture=inv1",
  "payMethod": null
}
```

`payUrl` est encodé tel quel dans le QR du marchand. Sans `payUrl`, le QR reste le `bolt11`.

`GET /api/public/invoices/:id` ajoute `demoPayment` et `payMethod` (`null` tant que personne n'a payé).

`POST /api/public/invoices/:id/pay` corps `{ "method": "lightning" | "wave" | "orange" | "yas" | "expresso" }` (`free` accepté comme alias de `yas`) → `{ status, amountXof, expiresAt, demoPayment: true, payMethod }`. Pas de clé d'idempotence dans ce contrat. Si la réponse finale de l'API diffère, réaligner `src/lib/schemas.ts` sur elle.

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
  "demo": false,
  "windowDays": 90,
  "thresholds": { "days": 14, "sales": 20 },
  "remaining": { "days": 0, "sales": 0 },
  "computedAt": "2026-10-17T18:00:00.000Z",
  "progress": { "daysSinceFirst": 6, "salesCount": 12 },
  "components": [{ "key": "regularity", "value": 0.76 }],
  "actions": [{ "text": "…", "points": 6 }]
}
```

`components.key` : `regularity | growth | volume | loyalty | quality`. `value` entre 0 et 1. `progress` peut être `null`. `demo` est vrai quand le score inclut un historique simulé ; `remaining` dit ce qu'il manque pour être éligible (le texte « Encore X ventes payées et Y jours » est composé à partir de ces deux nombres, sans calcul du score). `POST /api/score/share` répond 422 `NOT_ELIGIBLE` tant que `eligible` est faux ; le bouton est alors désactivé avec cette explication.

`GET /api/balance` → `{ balanceXof, balanceSats, demoRevenueXof, demoSalesCount, lastPayouts: [{ id, amountXof, network, status, createdAt }] }`. `balanceXof` est le solde retirable ; `demoRevenueXof` et `demoSalesCount` décrivent l'historique de démonstration, affiché à part et jamais retirable.

`quote` : `{ id, amountXof, receivedXof, exchangeRate, fees, network, accountNumberMasked, accountName, expiresAt }`

`payout` : `{ id, status, amountXof, network, reference, failureReason? }`

`network` : `wave | orange | free | expresso` (`free` est la valeur Bitnob de Yas, affichée Yas ; le formulaire envoie `free`, l'API accepte aussi `yas`)

`GET /api/system` → `{ env, demoPayMode, platformBalances, lastCalls: [{ at, method, path, status, durationMs, correlationId }], seedHistory? }`

## Attestation

`GET /api/public/shares/:token` est documentée dans `CONTRACTS.md` de `jaaykat-api` : `{ attestationId, shopName, status, issuedAt, expiresAt, demo, environment, windowDays, score, band, period: { from, to }, salesCount, totalXof }`, `status` : `valid | expired | revoked` (révoquée : `score`, `band`, `period`, `salesCount` et `totalXof` valent `null`), jeton inconnu : 404 (écran « Attestation introuvable »). La page `/s/:token` affiche ces champs, ce que l'attestation atteste et n'atteste pas, les règles de calcul et un QR vers la page. `demo` vrai : bandeau « Démonstration ». `environment` autre que `live` ou `production` : bandeau sur le réseau de test.

## Préférences locales, pas des routes

- `jk.session` = `{ token, expiresAt }` uniquement
- `jk.profile` : cache d'affichage `{ user, merchant }` pour l'en-tête hors ligne
- `jk.deviceId` : UUID anonyme du payeur
- `jk.quickAmounts` : quatre montants rapides sur l'appareil. Aucun PATCH marchand dans le contrat.
- `jk.cachedAt` : heure du dernier GET dashboard, ventes ou score reçu en ligne
