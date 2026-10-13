# FIT-151 - Documentation et validation profils/rôles

## Statut

`IN_PROGRESS` — contrôles locaux verts, build/backend à requalifier pour la V1.

## Objectif

Maintenir le contrat des rôles dans les docs actives et les checks du dépôt.

## Critères d'acceptation

- Le schéma PSQL documente profils, fonctions, triggers, grants et policies.
- Le schéma SQLite exclut explicitement les rôles.
- Architecture, offline-sync, sécurité, roadmap et suivi sont alignés.
- `db:docs:check`, `typecheck`, `build:web` et `backend:check` passent.
