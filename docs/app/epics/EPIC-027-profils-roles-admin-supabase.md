# EPIC-027 - Profils, rôles et administration Supabase

## Statut

`IN_PROGRESS` — à requalifier via FIT-175 après convergence Supabase V4. Les
contrats V3 historiques sont présents, mais la production ne permet pas encore
une QA basic/premium/admin complète et les nouveaux objets V4 n'ont pas leurs
policies finales.

## Objectif

Restaurer `user_profiles`, les rôles `basic`, `premium`, `admin` et leur
application cohérente dans la RLS, le frontend et les mutations catalogue.

## Périmètre

- Profil `basic` créé automatiquement pour chaque utilisateur Auth.
- Hiérarchie `basic < premium < admin` pour les capacités applicatives.
- Attribution des rôles uniquement par SQL ou service role.
- Trois comptes locaux distincts après reset.
- CRUD SQLite en local/dev et Supabase hors local pour les pages admin ciblées.
- RPC transactionnelle pour templates de session et niveaux.
- Documentation et tests automatiques des permissions.

## Hors périmètre

- Gestion des utilisateurs dans le frontend.
- Mutation Supabase de la page Exercices.
- Gating d'une fonctionnalité existante par le rôle premium.
- Intégration des rôles dans le backend Rust.
- Push vers la base Supabase distante.

## Critères d'acceptation

- Toute inscription obtient un profil `basic`.
- Le client ne peut modifier que son `display_name`.
- Basic et premium ne peuvent pas muter le catalogue.
- Admin hérite de premium et peut muter les tables autorisées.
- Une erreur de profil retire les capacités privilégiées sans fermer la session.
- Le reset local et `auth:roles:check` passent.

## Tickets

- `FIT-147` - Schéma profils, rôles, triggers et RLS.
- `FIT-148` - Capacités frontend et accès admin strict.
- `FIT-149` - CRUD catalogue local/Supabase et RPC session.
- `FIT-150` - Comptes locaux et tests de rôles.
- `FIT-151` - Documentation et validation finale.
