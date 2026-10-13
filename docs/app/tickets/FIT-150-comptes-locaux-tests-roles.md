# FIT-150 - Comptes locaux et tests des rôles

## Statut

`IN_PROGRESS` — implémenté localement, requalification V1 en cours.

## Objectif

Fournir des identités locales déterministes et tester les permissions réelles.

## Critères d'acceptation

- Le reset crée un compte basic, premium et admin.
- Aucun rôle n'est stocké dans `user_metadata` ou SQLite.
- `auth:roles:check` refuse toute URL distante.
- Le check valide profils, auto-promotion, CRUD autorisé/interdit et RPC.
