# FIT-169 — Migrations additives

Statut : `IN_PROGRESS` · EPIC-032. SQLite V32 est additive et couverte par un
smoke test réel ; Supabase, snapshot complet et rollback restent bloquants.

Remplacer les suppressions/troncatures SQLite et Supabase par une stratégie de
migration qui conserve programmes, évaluations, feedback et préférences.

Acceptation : tests de conservation sur données représentatives et rollback.
