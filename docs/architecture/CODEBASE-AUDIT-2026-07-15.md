# Audit de stabilité ACREA Fitness — 15 juillet 2026

> Statut : historique, non normatif. Voir
> `docs/audits/AUDIT-RELEASE-V1-2026-08-11.md` pour l'état courant.
## Résultat

La cause des régressions n'était pas un défaut unique du bouton. Le dépôt
permettait à une modification locale de traverser plusieurs domaines parce que
les commits, providers, repositories et écrans avaient un rayon d'impact trop
large, sans tests frontend pour arrêter les écarts.

La refonte de stabilisation a maintenant posé des frontières exécutables :

- machine d'état pure et horloge par timestamps pour le minuteur ;
- providers PWA, auth et base locale séparés de leurs infrastructures ;
- contrats publics entre catalogue, programmation et entraînement ;
- seeds catalogue hors du graphe TypeScript ;
- écrans ramenés à un rôle de composition ;
- diagnostics techniques pour les dégradations auparavant silencieuses ;
- tests Node, composants et E2E intégrés à la CI ;
- installation pnpm 11 reproductible et builds autorisés explicitement.

La matrice finale compte 82 scénarios automatisés : 72 tests Node, 5 tests de
composants et 5 parcours E2E.

## 1. Pourquoi le minuteur a semblé régresser après un changement de style

### Historique vérifié

Le commit stable du minuteur est
`bbfd49a37b64b546a51c5ddd8514ee39bab964bc`. Entre ce commit et le `HEAD`
audité, le domaine `workouts` n'avait reçu que des renommages de fichiers et
les imports associés. Le commit `42bd1bc` n'avait pas modifié
`useSessionTimer.ts`.

En revanche :

- `42bd1bc`, intitulé comme un correctif PWA, touche 29 fichiers et mélange
  santé API, navigation, provider PWA, primitive de bouton et renommages du
  minuteur ;
- `355f0b7`, intitulé comme une restauration AI/WASM, modifie 87 fichiers et
  traverse catalogue, programmation, entraînement, SQLite, Supabase, Rust, CI
  et documentation ;
- entre le commit stable du minuteur et `HEAD`, `TrainingScreen.tsx`, qui
  fournit le plan au minuteur, a subi 858 ajouts et 881 suppressions brutes.

Le changement visuel n'a donc pas modifié l'algorithme du minuteur. Il a été
livré dans la même unité que des changements structurels sans rapport, tandis
que le consommateur du minuteur avait déjà été remanié par un commit AI beaucoup
trop large. Cette absence d'atomicité rendait l'attribution trompeuse et le
retour arrière dangereux.

### Défauts latents de l'ancienne horloge

L'ancienne implémentation restait fragile même au commit déclaré stable :

- sept états React représentaient une seule machine métier ;
- cinq effets se coordonnaient implicitement ;
- chaque callback `setInterval` ajoutait exactement une seconde ;
- un onglet ralenti ou suspendu provoquait donc une dérive ;
- en répétitions, seul le repos incrémentait le temps planifié et le temps
  d'effort manuel n'était pas représenté séparément ;
- un plan modifié avec le même identifiant pouvait conserver un état obsolète ;
- aucune transition n'était testée.

### Correction retenue

`sessionTimerMachine.ts` est désormais un reducer pur. Chaque action reçoit
`nowMs` et calcule un delta absolu. L'état sépare le temps planifié, le temps
réel de séance, le repos, le compte à rebours et la série active.

Le hook React n'est plus qu'un adaptateur d'horloge. La façade publique du
minuteur fait 17 lignes ; construction du plan, snapshots et types sont séparés.
Dix tests protègent suspension, pause, reprise, repos nul, séries manuelles,
fin, changement de plan et grands sauts temporels. Le parcours répétitions est
également validé dans le build de production avec Playwright.

## 2. Causes structurelles et corrections

### Commits non atomiques

Cause : des intitulés ciblés masquaient des milliers de lignes et plusieurs
domaines. Une régression ne pouvait être ni localisée ni annulée proprement.

Garde-fou : la documentation de refonte impose une tranche métier par commit,
avec caractérisation avant extraction. Les renommages globaux, migrations,
styles et comportements ne doivent plus partager un commit.

### Absence de tests frontend

Avant l'audit, aucun runner de composants ou E2E ne protégeait thème,
navigation, badge API, auth ou minuteur rendu.

État actuel :

- 72 contrats Node ;
- 5 tests de composants avec Vitest, Testing Library et jsdom ;
- 5 E2E Playwright sur le build exporté ;
- jobs CI pour TypeScript, contrats, composants, build et E2E.

Les E2E couvrent :

1. retour des pages installation et désinstallation vers `/pwa` ;
2. badge API indisponible sans healthcheck valide ;
3. thème sombre par défaut, switch inversé vers clair et persistance ;
4. démarrage, pause et reprise du minuteur répétitions ;
5. déconnexion locale malgré l'indisponibilité du réseau distant.

### Providers à fort rayon d'impact

| Frontière | Avant | Maintenant |
| --- | ---: | ---: |
| `PwaProvider.tsx` | 1 199 lignes | 233 lignes |
| `database.ts` | 1 415 lignes | 111 lignes |
| `AuthProvider.tsx` | 465 lignes | 372 lignes |
| `catalogRepository.ts` | 2 992 lignes | 91 lignes |
| `TrainingScreen.tsx` | environ 985 lignes | 161 lignes |
| `CatalogScreen.tsx` | environ 1 060 lignes | 130 lignes |

Le provider PWA compose maintenant des hooks séparés pour santé, installation,
service worker et diagnostic. La racine place les capacités PWA optionnelles
derrière une boundary dégradée et conserve une boundary fatale distincte pour
la base/auth/profil.

La base locale possède des modules séparés pour file de tâches, erreurs,
verrou navigateur, port `LocalDatabase` et migrations.

L'auth sépare politique de rôles, profil Supabase et transport de déconnexion.
Une déconnexion locale hors-ligne efface réellement la session auth-js ; les
autres erreurs réseau restent observables.

### Catalogue monolithique

Le seed TypeScript de 20 247 lignes a été remplacé par
`catalogSeed.json`, hors compilation TypeScript. Les générateurs JSON, SQLite
et PostgreSQL vérifient maintenant leur dérive.

La façade catalogue de 91 lignes délègue à quatre repositories :

- équipements : 116 lignes ;
- formats : 383 lignes ;
- exercices : 368 lignes ;
- sessions : 175 lignes.

Lecture SQL, mapping, validation, cycle de synchronisation et écriture du seed
ont également leurs modules propres. L'entraînement ne charge plus le seed
généré et la programmation passe par `CatalogProgrammingPort`.

### Couplage entre domaines

Les routes et les domaines consomment désormais les index publics. Deux ports
nommés sont autorisés pour les besoins spécialisés :

- `@features/catalog/programming` ;
- `@features/training/history`.

Le test d'architecture échoue sur tout autre import profond
`@features/*/.../... `, sur un écran de plus de 400 lignes, un fichier source
avec tiret ou un bouton `quiet`.

Les plus grands écrans actuels font 393 lignes. Les écrans catalogue,
entraînement, profil et évaluation de niveau ont été séparés en composants, hooks,
services et fonctions de présentation.

### Erreurs techniques silencieuses

Les dégradations de wake lock, audio, service worker, analytics, santé API,
profil, WASM, stockage et auth alimentent maintenant un registre borné de
diagnostics techniques. Les fallbacks fonctionnels restent possibles, mais ne
sont plus invisibles.

Les `catch` restants correspondent à une validation de donnée, un fallback
documenté qui relance l'erreur originale ou une traduction explicite vers une
erreur publique stable.

### Environnement et CI

`pnpm-workspace.yaml` autorise uniquement le build `esbuild` requis par pnpm
11. `pnpm install --frozen-lockfile` passe avec le store du workspace.

Le validateur SQL lit désormais `migrations.ts`, propriétaire réel du schéma,
au lieu de l'ancienne façade `database.ts`. La commande de contrôle du snapshot
catalogue fournit également son entrée par défaut et n'est plus invalide.

La CI vérifie :

- TypeScript ;
- architecture ;
- minuteur, auth, PWA/API, base/migrations et catalogue ;
- AI/WASM et programmation ;
- composants ;
- documentation SQL ;
- formats et seeds catalogue/Supabase ;
- build de production ;
- cinq parcours E2E.

## 3. Convention de nommage

Le scan automatisé de `apps/pwa/src` ne trouve aucun fichier TypeScript ou TSX
avec tiret et aucune occurrence de `variant="quiet"`.

Le segment Expo `app/(app)/level-test.tsx` conserve volontairement son tiret :
il représente l'URL publique `/level-test`, pas un fichier source interne.

## 4. Matrice de preuve

| Contrat | Résultat |
| --- | --- |
| TypeScript strict | réussi |
| Tests Node | 72/72 |
| Tests de composants | 5/5 |
| E2E Playwright | 5/5 |
| Tests minuteur | 10/10 |
| Installation pnpm figée | réussie |
| Formats et seeds catalogue | à jour |
| Seed Supabase v2 | à jour |
| Documentation/migrations SQL | valide |
| Build web Expo de production | réussi |
| `git diff --check` | réussi |

## 5. Risques résiduels enregistrés

Ces éléments ne bloquent pas la stabilisation actuelle, mais restent des
frontières à surveiller :

- `catalogRemote.ts` contient encore lecture Supabase, mapping et dispatch
  d'écriture ; une prochaine tranche devra séparer read adapter, mapper et
  writer ;
- `migrations.ts` reste volumineux car il porte le schéma déclaratif complet ;
  sa taille est acceptée tant que les migrations restent versionnées,
  append-only et protégées par les contrats ;
- aucun lint général n'est encore déclaré ; le test d'architecture couvre les
  conventions critiques mais ne remplace pas ESLint ;
- les composants éditeurs du catalogue restent importants, bien que les écrans
  et règles métier soient maintenant séparés.

Toute nouvelle fonctionnalité doit conserver les tests et les seuils actuels
avant d'élargir ces modules.
