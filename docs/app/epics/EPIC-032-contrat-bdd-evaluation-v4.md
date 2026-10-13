# EPIC-032 — Contrat BDD et évaluation V4

Statut : `BLOCKED` — jalon M2.

## Objectif

Converger SQLite, Supabase local/production, contrats V4 et schémas
documentaires sans perte de données utilisateur.

## Critères de sortie

- Migrations SQLite réelles `0→cible` et `29→cible` vertes et additives.
- Migration fondatrice releases/médias/aliases/V4 et RPC présentes.
- Seed FR rejouable, activation atomique, rollback et RLS/pgTAP prouvés.
- Parité revision, volumes, relations et mappings entre environnements.
- Schémas SQL documentaires générés depuis les états validés.

## Tickets

- FIT-168 à FIT-174.
