# FIT-160 — Suppression de docs-legacy

Statut : `DONE` · EPIC-030.

Supprimer l'arbre historique après extraction des seules informations encore
utiles et conserver la suppression dans Git.

Preuve du 11 août 2026 : répertoire absent ; les 228 fichiers suivis restent
récupérables via Git ; les cinq fichiers non suivis supprimés étaient des
`.DS_Store` ; `seed:catalog:check` reste vert sans dépendance legacy.
