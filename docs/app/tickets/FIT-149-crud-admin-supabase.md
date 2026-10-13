# FIT-149 - CRUD admin Supabase

## Statut

`IN_PROGRESS` — implémenté localement, requalification V1 en cours.

## Objectif

Router les mutations admin vers SQLite en local/dev et Supabase hors local.

## Critères d'acceptation

- Équipements, repos, séries, répétitions, intervalles et formats sont routés.
- Templates de session et niveaux sont enregistrés atomiquement par RPC.
- Le cache SQLite est remplacé après relecture du snapshot distant.
- Les FK bloquent les suppressions référencées.
- Les mutations Supabase Exercices restent refusées.
