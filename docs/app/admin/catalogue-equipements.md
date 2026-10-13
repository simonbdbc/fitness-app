# Admin Catalogue Equipements

## Objectif

Ajouter une page admin pour gerer les lignes de `catalog_equipment`. Les
mutations utilisent SQLite en local/dev et Supabase hors local lorsque le profil
applicatif verifie porte le role `admin`.

## Route

- URL : `/admin/catalogue/equipements`
- Acces : menu `Admin > Equipements`
- Donnees : table `catalog_equipment`, dans SQLite en local/dev et dans Supabase
  hors local

## Règles d'administration

- Les 25 codes du référentiel métier sont immuables.
- L'édition porte sur les libellés uniquement.
- La création ou la suppression d'un code canonique est interdite depuis
  l'application. Une évolution du référentiel passe par migration versionnée.
- Le compteur affiche le nombre d'exercices lies a chaque equipement.

## Validations

- `code` appartient au référentiel canonique et reste inchangé.
- `label` non vide apres trim.
- Les erreurs de suppression referencee doivent etre explicites.

## Limites

- L'écran actuel expose encore des actions de création, renommage et
  suppression incompatibles avec ces règles. La mise en lecture seule des codes
  canoniques est un écart bloquant suivi par FIT-167 et FIT-175.
- Les fichiers seed du repo ne sont pas modifies par le navigateur.
- La bibliothèque V2 et son référentiel restent la source des identifiants ;
  SQLite n'est qu'un cache/runtime administrable pour les libellés autorisés.
- Hors local, une mutation Supabase reussie est suivie d'un rechargement du
  snapshot distant dans SQLite.
- Les droits distants et les policies RLS sont definis par l'EPIC 027.
- Le seed complet ne doit etre rejoue automatiquement que si le catalogue local
  est vide.
