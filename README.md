# Jaaykat — PWA

Application web installable pour un petit commerce à Dakar : encaisser un montant en francs CFA, montrer un QR Lightning, suivre les ventes, le tableau de bord et le score de régularité. Le même site sert sur téléphone, installé en plein écran. Il n'y a pas d'application native ni de fiche de store.

Le client paie depuis la page `/p/<slug>`. En mode démo (`demoPayment`), il choisit Portefeuille Lightning, Wave, Orange Money, Yas ou Expresso ; le débit est simulé et « Paiement reçu » n'apparaît que lorsque l'API renvoie `paid`. Le mobile money réel ne sert qu'au retrait.

## Ce qui est simulé

- Les ventes d'historique (`source: seed`) portent le badge « Historique simulé » et ne sont pas retirables. L'écran Solde sépare « Solde retirable » et « Chiffre d'affaires de démonstration ».
- L'attestation exige 14 jours et 20 ventes payées. Avec un historique simulé, elle est étiquetée « Démo » et n'atteste rien de réel ; en sandbox, elle signale des paiements de test.
- Aucun paiement de démo ne débite de compte. Hors démo, il faut un portefeuille Lightning : un compte mobile money ne paie pas la facture.
- Le numéro de téléphone est un identifiant déclaré, sans SMS. Un PIN oublié se réinitialise côté serveur.
- Le score est calculé par l'API, jamais dans le navigateur.

## Lancer

```bash
corepack pnpm install
corepack pnpm dev
```

Le proxy Vite envoie `/api` et `/webhooks` vers `http://localhost:3000`. En démo, l'API sert `dist/` sur la même origine : pas de variable `VITE_*`, pas de secret dans le front.

```bash
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
```

Copier le build vers l'API :

```bash
bash scripts/sync-web.sh
# ou, depuis Windows : scripts/sync-web.ps1
# destination par défaut : ../jaaykat-api/public
```

## PWA

Manifest `standalone`, français, portrait, icônes 192, 512, maskable et apple-touch. Sous 1024 px, l'espace marchand garde la barre d'onglets. À partir de 1024 px, une barre latérale remplace les onglets et le contenu s'étale jusqu'à 1280 px. La page client `/p/<slug>` reste une colonne étroite. Le service worker précache la coquille et met en cache uniquement les GET `/api/dashboard`, `/api/sales` et `/api/score`. Les POST `/api/invoices` et `/api/payouts` ne sont ni cachés ni rejoués. Les requêtes de lecture sont réessayées jusqu'à 3 fois avec attente progressive sur réseau, 408, 429 et 5xx, jamais sur 400, 401, 404, 409 ni 422 ; seul `/pay`, idempotent, est réessayé parmi les écritures. Hors ligne, les boutons d'encaissement, de paiement, de connexion, d'inscription et de retrait sont désactivés, avec la raison affichée.

Session : jeton opaque dans `localStorage` sous `jk.session` (`{ token, expiresAt }`). Un 401 sur une requête authentifiée efface la session, vide le cache local (requêtes en mémoire et caches du service worker) et ramène à la connexion.

## Docs

- [Formes JSON supposées](docs/formes-supposees.md)

Licence MIT.
