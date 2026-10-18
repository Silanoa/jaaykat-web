# SPEC — jaaykat-web

PWA marchand et page client. Les routes et enveloppes JSON suivent `CONTRACTS.md` du hub. Les champs imbriqués supposés sont listés dans `docs/formes-supposees.md`.

Écrans livrés : E01b, E02, E03, E04, E04b, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14 (partage du lien), E15–E20, E21 (bandeaux, erreurs, toasts), C1–C5, A1.

Le statut payé n'est affiché que si l'API renvoie `paid`. Les POST facture et retrait ne sont pas mis en cache.
