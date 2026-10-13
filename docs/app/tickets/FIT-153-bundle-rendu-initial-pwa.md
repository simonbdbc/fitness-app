# FIT-153 - Réduction du bundle et optimisation du rendu initial

## Statut

`TODO` — non commencé ou non prouvé pour la V1.

## Pilotage

- Priorité : moyenne.
- Responsable : Dev secondaire.
- EPIC : `EPIC-029`.

## Objectif

Réduire le JavaScript exécuté au démarrage et rendre un shell stable avant les
initialisations non critiques.

## Critères D'acceptation

- Les routes web Expo sont chargées de manière asynchrone en production.
- SQLite et le profil ACREA sont initialisés uniquement dans le groupe protégé.
- Les bundles administration, SQLite et WASM IA ne sont pas téléchargés au
  chargement de `/`, `/login` ou `/offline`.
- L'enregistrement du service worker, la version distante, les diagnostics et
  les probes non critiques sont différés après le premier rendu utile.
- Les restaurations auth et SQLite affichent un shell dimensionné plutôt qu'un
  écran vide.
- FCP est inférieur ou égal à 1,8 s, LCP à 2,5 s, TBT à 200 ms et CLS à 0,1.
- Expo Atlas ou un outil local équivalent documente les principaux modules du
  bundle initial sans publier de source maps en production.
