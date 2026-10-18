# QA démo Jaaykat

Dernière passe : 17 oct. 2026, sandbox Bitnob, API `jaaykat-api` et PWA `jaaykat-web`.

## Vérifications automatisées

| Contrôle | Outil | Résultat |
| --- | --- | --- |
| Logique pure (formats, étapes de paiement, libellés, hors ligne) | Vitest | passe |
| Écrans (client : choix, confirmation, en cours, reçu, Lightning ; marchand : attente, payé, login bloqué) | Vitest + Testing Library | passe |
| Typage | `tsc --noEmit` | passe |
| Parcours marchand de bout en bout avec API simulée (inscription, connexion, encaisser, QR, payé, tableau, score, retrait, solde, hors ligne) | Playwright `e2e/demo.spec.ts` | passe |
| Mise en page bureau/mobile (barre latérale, onglets, colonne client, panneau de marque) | Playwright `e2e/layout.spec.ts` | passe |
| Retrait (vignettes de réseau 44 px, zones tactiles, sélection sans décalage), attestation publique, score inéligible, solde avec démonstration, en 390 et 1440 | Playwright `e2e/payout-attestation.spec.ts` | passe |
| Audit responsive : 17 écrans × 7 largeurs (320, 360, 390, 768, 1024, 1440, 1920) | Playwright `e2e/audit.spec.ts` | 0 constat |

L'audit responsive échoue s'il détecte : défilement horizontal, élément hors écran, chevauchement de deux contrôles, cible tactile sous 44 px, champ sous 16 px, texte sous 12 px, texte coupé. Les captures sont écrites dans `test-results/audit/`.

Exceptions assumées de l'audit : les cases de la carte des heures de pointe (`data-dense`) ont 24 px minimum, car 18 colonnes × 7 jours ne tiennent pas en 44 px sur mobile ; la carte défile horizontalement dans son cadre. Les contrôles sous une barre fixe (onglets, bouton d'action collant) ne comptent pas comme chevauchement : le contenu défile sous la barre.

## Parcours vérifiés

- Inscription avec un nom normal, connexion, PIN refusé puis accepté, déconnexion.
- Encaissement : montant rapide ou pavé, génération du QR, attente, écran « Payé », « Nouvelle vente ».
- Page client `/p/:slug?facture=…` : synthèse boutique et montant, 5 moyens (Portefeuille Lightning, Wave, Orange Money, Yas, Expresso), étape « Confirmer le paiement de X F », « Paiement en cours » avec étapes Envoi, Confirmation, Reçu pilotées par le statut renvoyé par l'API, écran « Paiement reçu ».
- Portefeuille Lightning : QR de la facture bolt11, bouton « Copier la facture », lien `lightning:` « Ouvrir mon portefeuille », mention honnête que le règlement sandbox est simulé.
- Tableau de bord, ventes, score et attestation, retrait avec devis, solde.
- Retrait : quatre vignettes de réseau (logo 44 px, texte alternatif, zone tactile d'au moins 48 px, coche et fond sur le réseau choisi) ; le solde retirable est affiché au-dessus du pavé et un montant au-delà est refusé avec ce solde.
- Solde : « Solde retirable » d'un côté, « Chiffre d'affaires de démonstration » de l'autre, avec la mention « Non retirable » ; rien de tel pour un marchand sans historique simulé.
- Attestation : bouton désactivé avec « Encore X ventes payées et Y jours pour être éligible » ; émission puis lien, QR et durée de 7 jours ; refus du serveur affiché. Page publique : boutique, période, ventes payées, montant en F, score sur 100, date d'émission, identifiant, ce qu'elle atteste et n'atteste pas, règles, QR de vérification ; aucun téléphone. Un compte de démonstration porte le bandeau « Démonstration », un réseau de test le bandeau correspondant. Il n'y a ni PDF ni image.
- Page boutique publique sans session.
- Hors ligne : lecture du tableau en cache, encaissement bloqué avec message.
- Erreur réseau ou API : les lectures sont réessayées (3 fois, attente progressive) puis l'état d'erreur avec bouton « Réessayer » s'affiche. 400, 401, 404, 409 et 422 s'affichent tout de suite. Une 401 redirige vers la connexion et vide le cache local. Sur facture marchand, solde et suivi de retrait, un rafraîchissement qui échoue garde les données affichées et n'avertit qu'après 15 s ; le journal API garde aussi ses données, sans avertissement.
- Aucune écriture n'est rejouée automatiquement (inscription, connexion, facture, devis et retrait, partage du score) ; seul `/pay` l'est, car il est idempotent. Test : `src/lib/retry-policy.test.ts`.
- Parcours client : après la confirmation, l'écran Paiement en cours s'affiche tout de suite. Les erreurs transitoires de `/pay` et du polling (429, 5xx, coupure) sont réessayées sans rien afficher ; le message avec bouton « Réessayer » n'apparaît qu'après 15 s d'échec persistant.

## Fraîcheur des données et flashs

- Le front ne calcule jamais le statut : `paid` vient de l'API, qui relit Bitnob.
- Cadence inchangée : facture toutes les 2 s, tableau de bord toutes les 10 s, taux toutes les 60 s.
- Aucun texte « Vérification… » ni « Mise à jour du taux… » ne remplace le contenu : une ligne de hauteur réservée affiche « mis à jour il y a Xs ».
- Squelettes de même hauteur que le contenu, `placeholderData` sur tableau de bord et ventes (pas de blanc au changement de période).
- Rafraîchissement au retour sur l'onglet et à la reconnexion réseau ; après une vente payée, invalidation ciblée de `dashboard`, `sales`, `balance` et `score`.
- Transitions courtes (fondu 180 ms) ; `prefers-reduced-motion` coupe les animations, la coche s'affiche directement.

## Accessibilité

- Champs avec libellés, `aria-live` sur l'attente et l'écran payé, focus visible global, champs à 16 px (pas de zoom iOS), cibles de 48 px, zone de sécurité iOS sur la barre d'action et la bannière.
- Contrastes : texte principal et secondaire au-dessus de 4,5:1 sur le fond crème et sur blanc ; texte blanc sur vert `#0b6e4f` au-dessus de 6:1.
- Formats fr-FR : espace fine insécable pour les milliers, espace insécable avant « F », XOF en premier, sats en secondaire.

## Performance et PWA

- Routes chargées à la demande : bundle principal 435 kB (134 kB gzip), pages de 1,5 à 18 kB chacune.
- Manifeste avec icônes 192, 512 et maskable ; service worker `autoUpdate` avec `skipWaiting`, `clientsClaim` et nettoyage des anciens caches.

## Limites connues

- Sandbox Bitnob : aucune simulation de paiement d'une facture Lightning. En mode démo (`DEMO_PAY_MODE=manual`), le règlement est déclenché par l'auto-settle de la facture Bitnob créée au moment du choix du moyen. Le choix Wave, Orange Money, Yas ou Expresso est un libellé de démonstration, sans écran d'opérateur. Les vignettes de 44 px identifient seulement le moyen choisi : Wave (icône du site wave.com), Orange Money (pictogramme des deux flèches, SVG Wikimedia Commons du logo Orange Money), Yas (logo Yas depuis 2024, SVG Wikimedia Commons, ex-Free Sénégal) et Expresso (icône du site expressotelecom.sn). Le portefeuille Lightning garde un pictogramme d'éclair. `free` reste lu comme `yas` ; le `network` des retraits reste `free`, valeur attendue par Bitnob, affichée Yas.
- Le portefeuille Lightning affiche un vrai bolt11 sandbox ; un portefeuille mainnet ne peut pas le payer.
- Pas de page 404 dédiée : une adresse inconnue renvoie vers `/app`.
- Le chargement initial de la page client demande un fichier de plus (route à la demande) ; sur réseau lent, un fond uni s'affiche pendant ce temps.
- Pas de test sur appareil iOS réel ; la zone de sécurité est vérifiée par le CSS uniquement.
- Après une mise à jour du site, un navigateur de bureau peut garder l'ancienne version jusqu'à un rechargement forcé (Ctrl+Maj+R).