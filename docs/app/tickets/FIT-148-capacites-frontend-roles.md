# FIT-148 - Capacités frontend des rôles

## Statut

`IN_PROGRESS` — implémenté localement, requalification V1 en cours.

## Objectif

Faire de `user_profiles.account_type` la source distante des capacités UI.

## Critères d'acceptation

- `canAccessPremiumFeatures` vaut vrai pour premium et admin.
- `canAccessAdminCatalog` vaut vrai uniquement pour admin.
- Aucun bypass local ne transforme une session basic en admin.
- Une erreur de profil est visible et force les capacités basic.
- Le provider de démonstration sans Supabase reste basic.
