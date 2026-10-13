# EPIC 028 - IA Programme Hebdomadaire ACREA V4

Statut : `BLOCKED` — le contrat V4 existe côté code, mais la migration fondatrice
Supabase, la RPC V4, les templates de session et les candidats Proprioception
sont absents. FIT-176 pilote la bascule documentaire et fonctionnelle.

## Objectif

Générer localement une semaine ACREA complète à partir du profil authentifié,
de l'évaluation de niveau, du catalogue et de l'historique. Burn classe uniquement les
exercices principaux ; le moteur Rust applique les contraintes métier et
produit un snapshot stable partagé par l'accueil et l'entraînement.

## Historique V3 à clôturer

- Évaluation historique V3 : trois séances successives, six prescriptions et
  seuils propres aux exercices, validation technique explicite et niveaux
  calculés depuis les maximums de la troisième séance.
- Entrée historique `schemaVersion = 3`, semaine ISO, catalogue, profil,
  statistiques, progressions et historique d'appréciation.
- Durée définie par `sessionMinutesMin` et `sessionMinutesMax`, de 20 à 180
  minutes par pas de cinq.
- Journée composée de cinq phases : propositions libres d'échauffement et
  d'assouplissements autour des trois piliers principaux.
- Prescription exécutable persistée indépendamment du `formatId` d'audit.
- Appréciation obligatoire de 1 à 5 pour chaque exercice principal.
- `weeklyNoveltyPercent` pilote la continuité et la nouveauté hebdomadaires.
- Les snapshots V2/V3 doivent rester lisibles comme historique. La cible V1 est
  V4 et ne sera déclarée active qu'après FIT-168 à FIT-176.

## Architecture

- `crates/weekly-ai-core` : contrat V3, features, garde-fous, progression et
  composition quotidienne stable.
- `crates/weekly-ai-train` : distillation déterministe du scorer V1.
- `crates/weekly-ai-wasm` : scorer Burn Flex embarqué, sans WebGPU.
- PWA : évaluation reprenable, profil, progression par exercice, génération,
  feedback et persistance SQLite V28.
- Supabase : migrations programme V3, évaluation V2 puis affinage V3, tables d'évaluation,
  progression/exclusion, grants explicites et RLS propriétaire.
- Backend Rust : endpoint IA fondé sur le même core et protocole d'évaluation sans
  niveau initial codé en dur.

## Règles

- Aucun programme actif sans évaluation ACREA V4 complète et release catalogue
  correspondante.
- Échauffement et assouplissements sont des propositions libres de cinq
  minutes, terminables avant la fin, non scorées et non adaptables.
- Trois piliers obligatoires, exercices filtrés à `+/-1` du niveau testé.
- Objectif Complet équilibré ; objectif spécialisé ciblé à `50/25/25`.
- Les mêmes exercices sont repris sur chaque jour de la semaine.
- Répétitions et intervalles suivent les échelles persistantes définies dans le
  modèle fonctionnel ; douleur, arrêt ou qualité `<= 2` imposent la régression.
- Une progression dépassant la durée maximale est différée.
- Une appréciation d'évaluation initialise le premier classement et une note 1
  dépriorise seulement l'exercice. Une note 1 d'entraînement exclut et remplace
  les occurrences futures ; la restauration reste disponible dans le profil.
- Chaque exercice principal est suivi d'une récupération de 90 secondes,
  indépendante du feedback et incluse dans le budget maximal.
- Chaque prescription générée ou adaptée est liée à l'un des 2 219 formats
  canoniques avant toute persistance.

## Validation

```bash
cargo test --manifest-path crates/weekly-ai-core/Cargo.toml
cargo run --manifest-path crates/weekly-ai-train/Cargo.toml -- --check
cargo check --manifest-path fitness-service/Cargo.toml
pnpm --dir apps/pwa ai:wasm:build
pnpm --dir apps/pwa ai:test
pnpm --dir apps/pwa db:runtime:test
pnpm --dir apps/pwa component:test
pnpm --dir apps/pwa typecheck
pnpm --dir apps/pwa db:docs:check
pnpm --dir apps/pwa build:web
```

Les tests couvrent le scorer Burn réel, le rejet d'une évaluation antérieure à
V3, les cinq phases du programme, les six échelles de progression, les trois
séances d'évaluation, les 2 219 formats, la migration SQLite V27 vers V28 et
les règles RLS pgTAP.

## Suite Données Réelles

Le scorer Burn V1 reste inchangé. Une V2 entraînée sur des données réelles ne
sera engagée qu'après consentement versionné, pseudonymisation, séparation du
jeu de validation par utilisateur, métriques segmentées, surveillance de dérive
et procédure de retour au scorer V1.
