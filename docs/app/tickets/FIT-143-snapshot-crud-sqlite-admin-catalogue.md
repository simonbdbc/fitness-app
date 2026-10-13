# FIT-143 - Snapshot et CRUD SQLite admin catalogue

## Statut

`IN_PROGRESS` — validation locale acquise, requalification V1 en cours.

## Objectif

Faire lire et muter l'admin catalogue depuis SQLite local/dev.

## Criteres d'acceptation

- Le snapshot admin vient de SQLite reel.
- Les CRUD locaux couvrent sessions, niveaux, formats, series, repetitions,
  intervalles, repos et equipements.
- La table `catalog_exercises` peut etre lue pour les compteurs et contraintes,
  mais la page admin `exercices` est hors perimetre de cette tranche.
- Aucune mutation Supabase n'est appelee en local/dev.
