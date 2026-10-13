# FIT-145 - Export JSON et script seeds SQLite

## Statut

`IN_PROGRESS` — validation locale acquise, requalification V1 en cours.

## Objectif

Permettre de regenerer les seeds d'initialisation depuis un snapshot JSON issu
de SQLite local/dev.

## Criteres d'acceptation

- L'app exporte un snapshot JSON.
- `seed:catalog:update-from-snapshot` régénère uniquement les référentiels
  structurels et rejette exercices/templates non vides.
- `--check` echoue si les seeds ne correspondent pas au snapshot.
- Le script ne modifie pas Supabase distant.
