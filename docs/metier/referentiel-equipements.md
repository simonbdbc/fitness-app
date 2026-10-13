# Référentiel des équipements

Ce référentiel est la source métier commune aux bibliothèques, au PWA et à
Supabase. Chaque équipement possède un slug anglais stable, un libellé anglais
et un libellé français.

Les 25 slugs sont des identifiants canoniques immuables. L'administration peut
présenter ou corriger les libellés, mais ne peut ni renommer ni supprimer un
slug canonique. Un changement de référentiel passe par migration versionnée et
validation de toutes les fiches FR.

| Slug | English | Français |
|---|---|---|
| wall | Wall | Mur |
| chair | Chair | Chaise |
| table | Table | Table |
| countertop | Countertop | Plan de travail |
| couch | Couch | Canapé |
| stair | Stair | Marche |
| door | Door | Porte |
| towel | Towel | Serviette |
| rings | Rings | Anneaux |
| pull-up-bar | Pull-up bar | Barre de traction |
| low-bar | Low bar | Barre basse |
| vertical-bar | Vertical bar | Barre verticale |
| parallel-bars | Parallel bars | Barres parallèles |
| parallettes | Parallettes | Parallettes |
| bench | Bench | Banc |
| box | Box | Box |
| step | Step | Step |
| resistance-band | Resistance band | Élastique |
| jump-rope | Jump rope | Corde à sauter |
| kettlebell | Kettlebell | Kettlebell |
| rowing-machine | Rowing machine | Rameur |
| treadmill | Treadmill | Tapis de course |
| exercise-mat | Exercise mat | Tapis de sol |
| stationary-bike | Stationary bike | Vélo |
| no-equipment | No equipment | Sans équipement |

`other` n'est pas un équipement et n'existe pas dans l'architecture 2.0.
Lorsqu'aucun des 25 slugs ne décrit fidèlement le matériel indispensable, la
fiche reste dans `docs/bibliotheque-incomplete` sous
`unclassified-equipment`, avec la raison `equipment-unclassified`. Cet état de
tri n'est jamais persisté dans le catalogue, publié dans la PWA ou assimilé à
`no-equipment`.
