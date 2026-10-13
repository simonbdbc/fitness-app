# FIT-139 - CRUD Local Equipements SQLite

## Statut

`IN_PROGRESS` — validation locale acquise, requalification V1 en cours.

## Objectif

Permettre la creation, lecture, modification et suppression locale des lignes
`catalog_equipment`.

## Taches

- Ajouter une requete de liste avec compteur d'exercices lies.
- Ajouter un upsert local avec validation `code` et `label`.
- Refuser les codes invalides ou deja utilises.
- Ajouter une suppression locale bloquee si des exercices utilisent
  l'equipement.
- Eviter que le seed catalogue reecrase les modifications locales a chaque
  reload.

## Criteres d'acceptation

- Un equipement cree ou modifie reste present apres reload.
- Un code doit respecter `[a-z0-9]+(-[a-z0-9]+)*`.
- Un doublon de code est refuse.
- La suppression d'un equipement utilise renvoie une erreur explicite.
- Aucune mutation Supabase n'est declenchee par cette page.
