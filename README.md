# Jaaykat — PWA

Application web installable pour un petit commerce à Dakar : encaisser un montant en francs CFA, montrer un QR Lightning, suivre les ventes, le tableau de bord et le score de régularité. Le même site sert sur téléphone, installé en plein écran. Il n'y a pas d'application native ni de fiche de store.

Le paiement du client passe par la page `/p/<slug>`. En sandbox, deux modes coexistent. Sans `payUrl`, la facture Lightning se règle toute seule en quelques secondes. Avec `demoPayment` et `payUrl`, le client scanne le QR, ouvre la page et choisit Wave, Orange Money, Free Money ou Expresso. Le débit est simulé : l'écran affiche « Démo : paiement simulé, aucune somme réelle », et « Paiement reçu » n'apparaît que lorsque l'API renvoie `paid`. Ce n'est pas un encaissement réel. Le mobile money réel sert seulement au retrait, via le backend.

## Ce qui est simulé

- Les ventes d'historique marquées `source: seed` par l'API portent le badge « Historique simulé ». Elles ne sont pas retirables. Le solde affiché est celui du ledger renvoyé par `GET /api/balance`.
- Le paiement de la démo est un règlement sandbox, pas un paiement réel. En mode manuel, le choix Wave / Orange Money / Free Money / Expresso ne débite aucun compte.
- Il n'y a pas d'on-ramp Orange Money : un compte mobile money ne paie pas la facture. Hors démo, il faut un portefeuille Lightning. Le texte est sur « Comment payer ? ».
- Le numéro de téléphone est un identifiant déclaré. Aucun SMS n'est envoyé. Un PIN oublié se réinitialise sur le serveur, pas dans l'application.
- Le score est indicatif. Il n'est pas recalculé dans le navigateur.

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

Manifest `standalone`, français, portrait, icônes 192, 512, maskable et apple-touch. Sous 1024 px, l'espace marchand garde la barre d'onglets. À partir de 1024 px, une barre latérale remplace les onglets et le contenu s'étale jusqu'à 1280 px. La page client `/p/<slug>` reste une colonne étroite. Le service worker précache la coquille et met en cache uniquement les GET `/api/dashboard`, `/api/sales` et `/api/score`. Les POST `/api/invoices` et `/api/payouts` ne sont ni cachés ni rejoués. Hors ligne, les boutons d'encaissement, de paiement, de connexion, d'inscription et de retrait sont désactivés, avec la raison affichée.

Session : jeton opaque dans `localStorage` sous `jk.session` (`{ token, expiresAt }`). Un 401 sur une requête authentifiée efface la session et ramène à la connexion.

## Docs

- [Design](docs/superpowers/specs/2026-10-17-jaaykat-web-design.md)
- [Plan](docs/superpowers/plans/2026-10-17-jaaykat-web-implementation.md)
- [Formes JSON supposées](docs/formes-supposees.md)

Licence MIT.
