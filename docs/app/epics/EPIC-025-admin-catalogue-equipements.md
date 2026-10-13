# EPIC-025 - Admin Catalogue Equipements

## Statut

`BLOCKED` — à requalifier via FIT-175. Le CRUD historique des codes contredit
désormais le référentiel immuable des 25 slugs ; seule l'édition des libellés
autorisés peut rester dans le périmètre V1.

## Objectif

Fournir une page admin pour gerer `catalog_equipment` pendant la refonte du
catalogue metier. Le CRUD local initial est etendu hors local par l'EPIC 027.

## Perimetre

- Ajouter la route `/admin/catalogue/equipements`.
- Exposer la page dans le menu Admin.
- Permettre create, read, update et delete en SQLite local.
- Afficher le nombre d'exercices lies a chaque equipement.
- Bloquer la suppression d'un equipement utilise par au moins un exercice.
- Documenter les regles dans `docs/app/admin/catalogue-equipements.md`.

## Hors perimetre

- Gestion des profils et roles, couverte par l'EPIC 027.
- Policies RLS et mutation Supabase hors local, couvertes par l'EPIC 027.
- Modification automatique des fichiers seed depuis le navigateur.

## Criteres d'acceptation

- La page est accessible en session locale admin/dev.
- Les equipements se chargent depuis SQLite.
- Un equipement cree ou modifie reste present apres reload.
- Un code invalide ou doublon est refuse.
- La suppression d'un equipement utilise renvoie un message explicite.
- Les checks frontend et docs BDD restent valides.

## Tickets

- `FIT-138` - Route admin equipements.
- `FIT-139` - CRUD local equipements SQLite.
- `FIT-140` - Documentation et validation admin equipements.
