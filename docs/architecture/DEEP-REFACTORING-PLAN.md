# Plan de refonte profonde ACREA Fitness
## 1. Objectif

Réduire le rayon d'impact de chaque changement, rendre les comportements métier
testables sans navigateur et empêcher qu'une évolution de présentation modifie
implicitement l'authentification, la PWA, la base locale ou une séance.

La refonte avance par tranches réversibles : caractériser, extraire une
frontière, migrer un consommateur, valider, puis documenter.

## 2. Invariants non négociables

- Une modification visuelle ne modifie pas un reducer, repository ou contrat
  réseau dans le même commit.
- Toute règle métier vit dans une fonction pure ou une machine d'état testable.
- Un écran compose ; il ne possède pas à la fois orchestration, infrastructure
  et règles métier.
- Les hooks adaptent React aux services et reducers.
- Une dégradation optionnelle est observable et ne bloque pas le noyau.
- Les imports inter-domaines passent par un index public ou un port nommé.
- SQLite, Supabase, HTTP et WASM implémentent des frontières explicites.
- Toute migration possède un test de compatibilité et un chemin de reprise.
- Aucun écran source ne dépasse 400 lignes.
- Aucun fichier TypeScript/TSX interne n'utilise de tiret.
- Aucun bouton n'utilise `variant="quiet"`.

Ces invariants sont partiellement exécutables dans
`scripts/architecture-boundary-contract.test.mjs`.

## 3. Architecture de référence

```text
feature/
  contracts/       ports publics entre domaines
  domain/          types, invariants, reducers, fonctions pures
  services/        cas d'usage et orchestration
  infrastructure/  SQLite, Supabase, HTTP, WASM, navigateur
  components/      rendu et intentions utilisateur
  hooks/           adaptation React et cycle de vie
  screens/         composition et navigation
  index.ts          API publique
```

Les dossiers historiques peuvent conserver leurs noms pendant une migration,
mais aucun nouveau consommateur ne doit contourner l'index ou le port public.

## 4. Stratégie de livraison

Chaque tranche suit cet ordre :

1. `test(<domaine>): characterize <comportement>`
2. `refactor(<domaine>): extract <frontière>`
3. `refactor(<domaine>): migrate <consommateur>`
4. `test(<domaine>): cover <contrat>`
5. `docs(<domaine>): record <décision>`

Un commit ne mélange pas style, renommage global, migration de données et
comportement. Les artefacts générés sont isolés des diffs de logique.

## 5. Stratégie de tests

### Métier

- reducers et machines d'état ;
- mapping, invariants et données historiques ;
- calcul temporel avec timestamps injectés ;
- codes d'erreur stables.

### Composants

- états vide, chargement, erreur, dégradé et succès ;
- accessibilité et intentions utilisateur ;
- providers avec ports factices ;
- thème et persistance.

### Intégration

- migrations SQLite réelles ;
- file de tâches et verrou multi-onglets ;
- session auth-js et transport Supabase contrôlé ;
- WASM et fallback sur les mêmes contrats ;
- artefacts catalogue déterministes.

### E2E

- navigation installation/désinstallation ;
- badge API ;
- thème sombre/clair ;
- minuteur répétitions ;
- déconnexion locale hors-ligne.

Le prochain élargissement E2E doit couvrir une séance guidée complète et la
régénération AI d'une semaine.

## 6. Portes CI

Ordre actuel :

1. TypeScript strict ;
2. contrats d'architecture et métier ;
3. tests de composants ;
4. validation migrations, documentation et seeds ;
5. build web ;
6. E2E ;
7. déploiement.

Une porte n'est couvrante que si sa rupture volontaire fait échouer le test.

## 7. Registre de progression

| Tranche | État | Preuve |
| --- | --- | --- |
| Socle de tests | Terminé | 72 Node + 5 composants + 5 E2E |
| Minuteur | Terminé | reducer timestamp, façade 17 lignes, 10 tests, E2E |
| PWA | Terminé | provider 233 lignes, hooks/services séparés, badge/navigation testés |
| Base locale | Terminé | façade 111 lignes, port/verrou/file/migrations séparés |
| Catalogue | Terminé pour la stabilisation | JSON hors TS, façade 91 lignes, 4 writers, ports et contrats |
| Programmation/IA | Terminé pour les frontières | ports catalogue/historique, WASM/fallback contractuels |
| Entraînement | Terminé | écran 161 lignes, composants/hook/domain séparés |
| Authentification | Terminé | politique/adaptateur séparés, logout local hors-ligne testé |
| Composition racine | Terminé | PWA dégradée isolée du noyau fatal |
| Grands écrans | Terminé | aucun écran source > 400 lignes |
| Reproductibilité | Terminé | pnpm figé, allowBuilds ciblé, seeds et build verts |

## 8. Exceptions temporaires datées

| Date | Module | Motif | Sortie attendue |
| --- | --- | --- | --- |
| 2026-07-15 | `catalogRemote.ts` | lecture, mapping et écriture Supabase encore regroupés | extraire reader, mapper et writer avant la prochaine évolution remote |
| 2026-07-15 | `migrations.ts` | schéma déclaratif complet dans une unité versionnée | conserver append-only et tests ; découper seulement avec migration vérifiée |
| 2026-07-15 | éditeurs catalogue | composants longs mais règles et écran déjà séparés | extraire des sections lors de la prochaine évolution UI |
| 2026-07-15 | lint général | absent du paquet | introduire ESLint sans mélanger avec une évolution métier |

## 9. Définition de terminé

Une tranche est terminée lorsque :

- ses règles sont dans une unité testable ;
- ses consommateurs passent par une façade stable ;
- les erreurs pertinentes sont observables ;
- TypeScript, contrats, composants, build et E2E restent verts ;
- les scripts locaux sont exécutables sans argument caché ;
- la décision et les exceptions sont documentées.
