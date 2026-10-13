# Persistance CRUD SQLite admin catalogue

## Objectif

Les pages admin catalogue fonctionnent sur SQLite en local/dev. Hors local, les
mutations sont routees vers Supabase sous RLS, puis le snapshot distant recharge
le cache SQLite. Un profil applicatif `admin` verifie est obligatoire.

## Tables couvertes

- `catalog_session_templates`
- `catalog_session_template_levels`
- `catalog_formats`
- `catalog_series`
- `catalog_repetitions`
- `catalog_intervals`
- `catalog_rests`
- `catalog_equipment`

`catalog_exercises` reste lisible pour les compteurs et contraintes de
reference, notamment les equipements utilises, mais la page admin `exercices`
est hors perimetre de cette tranche.

## Regles CRUD

- En local/dev, les lectures admin viennent de SQLite reel, pas du seed
  TypeScript en memoire.
- En production, les lectures admin viennent de Supabase. Le snapshot distant
  met ensuite a jour SQLite en cache opportuniste : un echec du cache local est
  journalise mais ne masque ni les donnees Supabase ni le resultat d'une
  mutation distante.
- Le seed d'initialisation s'applique seulement quand le catalogue local est
  vide.
- Les suppressions des briques de format sont bloquees quand un format les
  reference.
- `catalog_intervals` stocke uniquement la durée d'effort. Les notions de
  maintien, contrôle et maximum ne sont pas des types d'intervalle.
- `catalog_repetitions.reps` est positif ou `NULL`. Une unique ligne
  `reps-maximum` avec `reps IS NULL` représente la répétition `Maximum`.
- Les index garantissent l'unicité de chaque valeur numérique, de la ligne
  `Maximum` et de chaque durée d'intervalle.
- La suppression d'un template de session supprime ses associations de niveaux
  par cascade.
- `catalog_session_templates` stocke l'exercice et le statut. Le pilier et la
  famille sont derives par jointure avec `catalog_exercises`.
- `catalog_session_template_levels` porte le many-to-many entre templates et
  niveaux 1 a 10.
- Les anciennes tables de seances et definitions ne sont pas restaurees.
- Les mutations Supabase couvrent uniquement les tables de cette page et sont
  refusees aux profils `basic` et `premium`.
- L'enregistrement d'un template de session et de ses niveaux utilise la RPC
  transactionnelle `admin_upsert_catalog_session_template`.
- La page Exercices et ses mutations Supabase restent hors perimetre.

## Validation manuelle

Pour chaque page admin : creer, modifier, supprimer si possible, recharger
l'application, verifier la presence de la modification et verifier le blocage
des suppressions referencees.
