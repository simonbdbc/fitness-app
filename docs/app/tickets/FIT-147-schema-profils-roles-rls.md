# FIT-147 - Schéma profils, rôles et RLS

## Statut

`IN_PROGRESS` — implémenté localement, requalification V1 en cours.

## Objectif

Créer `user_profiles`, synchroniser Supabase Auth et protéger les rôles.

## Critères d'acceptation

- L'enum contient exactement `admin`, `premium`, `basic`.
- Le trigger crée les nouveaux profils en `basic` et synchronise l'email.
- Le backfill préserve les rôles existants.
- Le propriétaire lit son profil et modifie seulement `display_name`.
- `private.is_admin()` est protégé et utilisé par les policies catalogue.
