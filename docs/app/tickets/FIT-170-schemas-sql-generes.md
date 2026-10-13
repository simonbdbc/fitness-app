# FIT-170 — Schémas SQL générés

Statut : `IN_PROGRESS` · EPIC-032.

Le contrat SQLite des préférences est réaligné sur `exercise_slug` et le check
documentaire passe. Régénérer encore `schema-sqlite.sql` et `schema-psql.sql`
depuis les bases validées, notamment après création de V4.

Acceptation : le check compare colonnes, contraintes, index, RPC, grants et RLS
aux runtimes réels.
