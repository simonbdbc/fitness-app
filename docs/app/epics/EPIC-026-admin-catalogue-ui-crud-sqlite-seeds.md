# EPIC-026 - Admin Catalogue UI, CRUD SQLite et Seeds

## Statut

`BLOCKED` — à requalifier via FIT-175. Les migrations SQLite réelles passent
désormais les smoke tests 0→32 et V29→32, mais la preuve sur copie complète,
le build candidat et les templates de session manquent encore.

## Objectif

Harmoniser les pages admin catalogue avec un socle de composants UI extrait du
modele canonique `/admin/catalogue/intervalles`, puis verrouiller le CRUD
local/dev via SQLite. L'EPIC 027 etend ce routeur vers Supabase hors local.

## Perimetre

- Extraire les composants admin reutilisables.
- Adapter `sessions`, `niveaux`, `formats`, `series`, `repetitions`, `repos`
  et `equipements` sur le modele `intervalles`.
- Charger l'admin depuis SQLite reel.
- Ajouter les tables minimales canoniques pour sessions/niveaux admin.
- Simplifier les formats aux associations série, répétition/intervalle et
  repos, puis remplacer les anciennes tables de séance par les templates de
  session et leurs niveaux.
- Simplifier les intervalles à leur durée d'effort et représenter la répétition
  `Maximum` par une valeur `reps` nulle, sans types techniques persistés.
- Ajouter le script de mise a jour des seeds depuis un export JSON SQLite.
- Documenter les regles et tickets actifs.

## Hors perimetre

- Mutation Supabase distante dans cette EPIC, prise en charge separement par
  l'EPIC 027.
- Page admin `exercices`, conservee dans le code mais hors de cette tranche.
- Refonte programme complete.
- Restauration des tables legacy catalogue.

## Criteres d'acceptation

- Les pages admin citees partagent le socle UI commun issu de
  `/admin/catalogue/intervalles`.
- `formats`, `series`, `repetitions`, `repos`, `sessions`, `niveaux` et
  `equipements` gardent seulement leurs champs et contraintes metier propres.
- Les CRUD locaux persistent apres reload.
- Le bloc `Formats liés` est replié par défaut et son compteur est dynamique.
- Le catalogue actif contient exactement 11 entrées de répétitions, 14 durées
  d'intervalles et 2 219 formats canoniques ; une seule répétition porte
  `reps IS NULL`.
- Les modales répétition et intervalle n'exposent plus de type legacy.
- La programmation résout dynamiquement un format compatible pour chaque
  template actif et niveau autorisé.
- Les suppressions referencees sont bloquees.
- `seed:catalog:update-from-snapshot` régénère uniquement les référentiels
  structurels ; exercices et templates non vides sont rejetés.
- `db:docs:check`, `typecheck` et `build:web` restent valides.

## Tickets

- `FIT-141` - Socle composants UI admin catalogue.
- `FIT-142` - Migration pages sessions/niveaux/equipements.
- `FIT-143` - Snapshot admin et CRUD SQLite local.
- `FIT-144` - Tables minimales sessions/niveaux admin.
- `FIT-145` - Export JSON et script de mise a jour seeds.
- `FIT-146` - Tests et validation admin catalogue.
