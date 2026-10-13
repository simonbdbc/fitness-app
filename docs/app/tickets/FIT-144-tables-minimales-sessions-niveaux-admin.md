# FIT-144 - Tables minimales sessions/niveaux admin

## Statut

`IN_PROGRESS` — implémenté localement, requalification V1 en cours.

## Objectif

Ajouter les tables canoniques minimales necessaires aux pages admin sessions et
niveaux.

## Criteres d'acceptation

- `catalog_session_templates` existe et référence un exercice.
- `catalog_session_template_levels` existe avec une clé composée et des
  niveaux contraints entre 1 et 10.
- Les anciennes tables `catalog_seance_templates`,
  `catalog_level_seance_templates`, `catalog_session_definitions`,
  `catalog_seance_template_sessions`, `catalog_sessions`,
  `catalog_level_sessions` et `catalog_session_exercises` ne reviennent pas.
