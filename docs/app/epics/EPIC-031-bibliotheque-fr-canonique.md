# EPIC-031 — Bibliothèque V2 canonique

Statut : `IN_PROGRESS` — jalon M1.

## Objectif

Faire de `docs/bibliotheque` la seule source opérationnelle, avec une fiche
bilingue complète par exercice, provenance, qualité éditoriale, taxonomie et
statut de programmation prouvés.

## Critères de sortie

- Les 707 fiches complètes V2 et leurs 1 414 médias sont générés depuis
  `docs/bibliotheque` ; les 555 incomplets sont exclus par contrat.
- Chaque fiche publiée a ses Markdown FR/EN, son poster, son animation et un
  équipement canonique ; une fiche incomplète n'est jamais publiée ni
  `eligible`.
- Les cinq piliers V2 sont couverts, avec une classification validée pour les
  fiches complètes et incomplètes.
- Les trois piliers ACREA et les phases de séance disposent de candidats
  approuvés et de templates versionnés.
- PWA, SQLite et Supabase partagent la même release/revision/hash V2.
- Exercices et slugs équipement sont en lecture seule dans l'admin.

## Tickets

- FIT-161 à FIT-167.
