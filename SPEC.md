# SPEC — jaaykat-web (piste web + mobile PWA)

**Owner :** toi  
**Stack :** Vite 8, React 19, React Router 8, TanStack Query 5, Zustand 5, Tailwind 4, shadcn/ui, Recharts, qrcode, zod, vite-plugin-pwa  
**Mobile :** pas de native — PWA installable (`display: standalone`)  
**Done :**
- **20h00** : E05→E06→E07 live via tunnel
- **00h00** : C1→C3 + E01b installable + E02/E03
- **09h00** : PWA installée téléphone A, Lighthouse PWA OK, parcours 1–7 jouables

---

## 1. Responsabilités

- Tous les écrans marchand E00–E21 et client C1–C5 + attestation A1
- Polling 2 s (facture) / 10 s (dashboard)
- Session `jk.session` + Bearer
- Manifest + service worker + install prompt
- Validation formulaires (zod partagé concepts avec API)
- Affichage hors ligne (cache GET uniquement)

## 2. Interdits

- Appeler Bitnob / connaître la clé
- Tout secret en `VITE_*`
- Calculer un statut paiement côté client (afficher ce que l’API renvoie)
- Cache / replay des POST invoices ou payouts hors ligne
- App native / store

## 3. Structure

```
jaaykat-web/
├─ src/
│  ├─ pages/          # E*, C*, A1
│  ├─ components/     # UI + QR + heatmap + score gauge…
│  ├─ hooks/          # useSession, useInvoicePoll, useOnline
│  ├─ lib/            # api client, formatXof, zod schemas
│  └─ styles/
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/          # 192, 512, maskable, apple-touch-icon
│  └─ …
├─ vite.config.ts     # proxy /api → :3000 en dev ; PWA plugin
├─ index.html
├─ SPEC.md
└─ README.md
```

## 4. Routes SPA

| Path | Écran | Auth |
|------|-------|------|
| `/app` | redirect E05 ou E04 | — |
| `/app/login` | E04 | non |
| `/app/register` | E02→E03 | non |
| `/app/charge` | E05 | oui |
| `/app/invoice/:id` | E06 / E07 | oui |
| `/app/qr` | E08 | oui |
| `/app/sales` | E09 | oui |
| `/app/dashboard` | E11 | oui |
| `/app/score` | E12 | oui |
| `/app/balance` | E15 | oui |
| `/app/payout` | E16→E18 | oui |
| `/app/settings` | E19 | oui |
| `/app/system` | E20 (jury) | oui |
| `/p/:slug` | C1→C3 | non |
| `/s/:token` | A1 | non |

Tab bar (4) : Encaisser · Ventes · Tableau · Score.  
Pages client / attestation : **sans** tab bar.

## 5. Client HTTP

```ts
// Authorization: Bearer depuis jk.session
// 401 → clear session → /app/login
// Idempotency-Key: UUID sur POST /api/invoices et POST /api/payouts
```

Dev : `vite` proxy `/api` et `/webhooks` vers `http://localhost:3000`.  
Prod : relative URLs (même origine).

## 6. Priorité écrans

### P0 (démo obligatoire)

| ID | Nom | Notes |
|----|-----|-------|
| E01b | Installer | `beforeinstallprompt` + aide iOS |
| E02 | Créer boutique | validation locale |
| E03 | PIN | puis `POST /register` |
| E04 | Login | états lock / rate-limit |
| E05 | Encaisser | montants rapides, XOF d’abord |
| E06 | QR facture | QR ≥ 240 px, countdown, bandeau sandbox |
| E07 | Payé | vert plein, son, `navigator.vibrate` |
| E08 | QR universel | URL `/p/<slug>` |
| E09 | Ventes | filtres + badge seed |
| E11 | Dashboard | KPIs + heatmap + conseil |
| E12 | Score | jauge + composantes |
| E21 | Motifs | hors ligne, sandbox, toasts, erreurs |
| C1 | Boutique client | montant + prénom optionnel |
| C2 | Paiement en cours | poll 2 s |
| C3 | Reçu | |

### P1 (si temps)

E00, E01, E04b, E10, E13, E14, E15–E18, E19, E20, C4, C5, A1.

## 7. États obligatoires par écran P0

Vide · Chargement (squelettes) · Erreur (action) · Hors ligne · Succès.

Bandeau hors ligne : « Hors ligne : vos chiffres datent de HH:MM ».  
Bandeau sandbox permanent discret.

## 8. PWA

```json
{
  "name": "Jaaykat",
  "short_name": "Jaaykat",
  "start_url": "/app",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "lang": "fr"
}
```

Workbox :
- Precache shell
- GET `/api/dashboard`, `/api/sales`, `/api/score` → stale-while-revalidate + IndexedDB
- **Jamais** cache POST invoices/payouts
- `registerType: "autoUpdate"`

## 9. UX / design tokens (si pas Figma prêt)

| Token | Valeur |
|-------|--------|
| bg | `#FAF7F2` |
| primary | `#0B6E4F` |
| accent Lightning | `#F7931A` (texte `#111827` seulement) |
| success | `#0B6E4F` sur `#E7F4EE` |

Typo : Inter, chiffres tabulaires.  
Montants : `12 500 F` (espace insécable).  
Une action principale en bas (bouton full width ≥ 48 dp).  
Maquettes cible 360×640.

## 10. Polling

| Vue | Intervalle | Endpoint |
|-----|------------|----------|
| E06 / C2 pending | 2 s | GET invoice |
| Dashboard | 10 s | GET dashboard |
| Payout E18 | 2 s | GET payout |

Stop polling dès état terminal ou unmount.

## 11. Formats & microcopie

- Vouvoiement, français, phrases courtes
- « Facture » pas « invoice » ; sats secondaires
- « Paiement simulé · sandbox »
- « Historique simulé » sur lignes seed
- Erreurs : ce qui s’est passé + quoi faire

## 12. Parcours démo à valider (2 téléphones)

1. Onboarding E01b→E02→E03→E05  
1b. Login / logout  
2. Comptoir E05→E06→E07 (&lt; 15 s)  
3. Client scanne affiche → C1→C3 ; A voit E07  
4. Dashboard E11  
5. Score E12  
6. Retrait E15→E17 (devis réel)  
7. Hors ligne : lecture cache, POST désactivés

## 13. Timeline toi (web)

| Bloc | Focus |
|------|-------|
| 1 | Squelette Vite/React/Tailwind/router/tab/manifest |
| 2 | E05–E07 branchés + Bearer + E04 |
| 3 | E01b, E02–E03, E08–E09, C1–C3, SW |
| 4 | E11, E12, E15–E18 |
| 5 | États, a11y, Lighthouse, icônes, affiche A6 |
| 6 | Fixes + vidéo démo |

## 14. Build pour l’API

```bash
pnpm build
# sortie → dist/
# l’API copie dist/ vers jaaykat-api/public/
```

Script suggéré dans workspace : `scripts/sync-web.ps1`.

## 15. Coordination designer

Si Figma en retard : shipper tokens ci-dessus + Lucide ; remplacer assets au bloc 5.  
Handoff attendu : icône 1024, SVG logo, tokens JSON, feuille textes FR.
