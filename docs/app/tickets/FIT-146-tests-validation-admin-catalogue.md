# FIT-146 - Tests et validation admin catalogue

## Statut

`IN_PROGRESS` — validation locale acquise, requalification V1 en cours.

## Objectif

Valider la refonte UI/CRUD/seeds de l'admin catalogue.

## Criteres d'acceptation

- `pnpm seed:formats:check` passe.
- `pnpm seed:catalog:check` passe.
- `pnpm db:docs:check` passe.
- `pnpm typecheck` passe.
- `pnpm build:web` passe.
- Les pages ciblees utilisent la structure globale de
  `/admin/catalogue/intervalles`.
- Les scenarios CRUD manuels sont verifies sur `sessions`, `niveaux`,
  `formats`, `series`, `repetitions`, `intervalles`, `repos` et `equipements`.
- Les durées de 90 et 150 secondes sont affichées `1.30 min` et `2.30 min`.
- Le seed contient exactement 11 entrées de répétitions, 14 durées
  d'intervalles, 651 formats répétitions et 1 568 formats intervalles, soit
  2 219 formats canoniques.
- Une seule répétition porte `reps IS NULL` et aucun intervalle ne porte de
  type.
- `maximum_reps`, `controlled_reps`, `hold_position`, `interval_kind` et
  `repetition_kind` sont absents du modèle actif.
- Les anciennes colonnes numériques de format et les anciennes tables de
  séance sont absentes des schémas actifs.
- `/admin/catalogue/exercices` est hors perimetre de cette validation.
