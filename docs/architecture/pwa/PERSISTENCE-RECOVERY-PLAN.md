# Plan de correction de la persistance PWA

Date de recadrage : 14 août 2026. Référence fonctionnelle observée :
`f5cd675 feat(timer): persist sessions with AsyncStorage`.

## 1. Constat et règle de décision

Le retour arrière-plan → premier plan a été validé humainement sur `f5cd675`.
Les centralisations livrées ensuite n'ont jamais obtenu ce même niveau de
preuve :

- `6ad704e5` a étendu la persistance à tous les écrans ;
- `4dd95314` a ajouté un cycle de vie partagé ;
- `e99a67b8` a centralisé la reprise de la PWA installée ;
- `087cc45b` a restauré les fichiers du Minuteur, mais a conservé des couches
  de reprise postérieures autour du shell et de l'Entraînement ;
- `1eda0ad3` a ajouté un checkpoint de route et `launch_handler` ; la QA réelle
  est encore revenue sur `/home` ;
- la tentative suivante de persistance route/scroll n'a pas été déployée et a
  été abandonnée car elle généralisait le mécanisme avant le gate humain.

La phase 1 revient donc au comportement strict de `f5cd675`. Un test de hash
verrouille les fichiers et l'enveloppe PWA de référence : toute évolution de
ces fichiers est interdite avant validation humaine explicite.

## 2. Périmètre strict de la phase 1

### Minuteur autonome

Les fichiers suivants restent identiques octet pour octet à `f5cd675` :

- `sessionTimerMachine.ts` ;
- `useSessionTimer.ts` ;
- `sessionTimerPersistence.ts` ;
- `timerScreenPreferences.ts` ;
- `TimerScreen.tsx`.

Le déroulement utilise exclusivement AsyncStorage V2. La restauration se
termine avant la première écriture. Au passage caché, le snapshot courant est
sauvegardé directement par le hook. Si le composant reste monté, Expo Router
conserve l'URL et le minuteur continue son cycle normal. Après un véritable
démontage/remontage, un état démarré revient en pause, sans rattrapage du temps
hors écran.

### Entraînement guidé

Les quatre fichiers de reprise observés sur `f5cd675` sont également verrouillés :

- `GuidedTrainingSession.tsx` ;
- `TrainingScreen.tsx` ;
- `guidedTrainingResume.ts` ;
- `guidedTrainingFeedbackResume.ts`.

La séance, l'index et les feedbacks reprennent de manière synchrone depuis les
clés Web historiques. Les minuteurs d'effort et de récupération réutilisent le
même `useSessionTimer` AsyncStorage V2 que le Minuteur autonome.

### Shell et navigation

Le shell ne possède plus de logique fonctionnelle de premier plan :

- aucun checkpoint de route ;
- aucun `launchQueue` ni `launch_handler` ;
- aucune persistance de scroll ou d'état d'écran ;
- aucun listener `visibilitychange` ou `pagehide` dans le layout protégé ;
- aucune navigation, redirection ou remontage déclenché par un retour visible.

Le point d'entrée, le document HTML, le manifeste, les trois layouts du shell,
le fournisseur PWA et son cycle service worker sont eux aussi identiques octet
pour octet à `f5cd675`. Les versions d'Expo, Expo Router, React, React Native,
React Native Web et AsyncStorage sont inchangées. La vérification distante des
releases catalogue est déclenchée uniquement à l'ouverture de la Bibliothèque ;
elle n'installe plus de listener global dans le shell.

`app/index.tsx` sert uniquement au démarrage froid et redirige une session
authentifiée vers `/home`. Il ne doit pas être exécuté lors d'un simple retour
au premier plan d'un document encore monté.

## 3. Nettoyage effectué

1. Supprimer `installedRouteResume` et ses tests.
2. Retirer `launch_handler.client_mode` du manifeste et de la validation PWA.
3. Retirer la persistance route/scroll expérimentale.
4. Retirer les hooks asynchrones de reprise Entraînement ajoutés après
   `f5cd675` et restaurer les lectures synchrones de la référence.
5. Retirer les branches de blocage AsyncStorage devenues sans consommateur.
6. Conserver uniquement la file AsyncStorage encore utilisée par les domaines
   catalogue, évaluation et préférences audio ; elle ne pilote aucun lifecycle.

## 4. Validation automatisée de phase 1

La matrice doit vérifier :

1. les vingt fichiers critiques de l'enveloppe PWA, du Minuteur et de
   l'Entraînement ont exactement les SHA-256 de `f5cd675` ;
2. les six dépendances runtime critiques conservent les versions de
   `f5cd675` ;
3. un événement caché/visible ne change jamais `/timer` ou `/training` ;
4. le Minuteur sauvegardé revient en pause après navigation puis remontage ;
5. la séance et les feedbacks Entraînement sont lus synchroniquement ;
6. le layout protégé ne contient aucun propriétaire de navigation lifecycle ;
7. le service worker ne recharge qu'après acceptation explicite d'une mise à
   jour ;
8. tests minuteur, composants, architecture, contrats PWA, typecheck, build,
   validation PWA et E2E passent sur un build frais.

Commandes :

```bash
pnpm --dir apps/pwa timer:test
pnpm --dir apps/pwa component:test
pnpm --dir apps/pwa architecture:test
pnpm --dir apps/pwa pwa:contract:test
pnpm --dir apps/pwa typecheck
pnpm --dir apps/pwa build:web
pnpm --dir apps/pwa validate:pwa
pnpm --dir apps/pwa e2e:test
```

Résultat local du 14 août 2026 : `PASS` sur 15/15 tests machine, 75/75 tests
composants, 5/5 contrats d'architecture, 19/19 contrats PWA/API, typecheck,
build Web frais, validation PWA et 13/13 scénarios E2E avec service workers
actifs. Le contrôle de hash couvre vingt fichiers avec toute l'enveloppe PWA.
Le contrôle rendu du build frais atteint correctement l'écran de connexion ;
les routes protégées restent couvertes par les E2E à session
simulée en attendant le gate installé avec le compte réel.

## 5. Gate humain obligatoire

Après commit, déploiement et acceptation explicite de la mise à jour :

1. relever l'identifiant de build affiché par la PWA ;
2. désinstaller puis réinstaller la PWA pour éliminer un manifeste installé
   provenant d'une tentative précédente ;
3. ouvrir `/timer`, démarrer un minuteur et attendre la fin du décompte ;
4. passer en arrière-plan au moins trente secondes puis revenir par le sélecteur
   d'applications ; vérifier l'URL, l'écran et le minuteur ;
5. répéter le retour par l'icône installée ;
6. ouvrir `/training`, démarrer une séance, avancer d'un exercice et saisir un
   feedback ; rejouer les deux modes de retour ;
7. naviguer volontairement ailleurs puis rouvrir Timer et Entraînement pour
   vérifier leur reprise stockée ;
8. consigner plateforme, navigateur, build, résultat et capture en cas d'échec.

Résultat humain actuel : `EN ATTENTE`. Un test automatisé ne remplace pas la
suspension réelle décidée par l'OS.

## 6. Étape suivante, seulement après accord

Après validation humaine explicite de Timer et Entraînement, concevoir une
persistance centralisée neuve à partir de cette base. Elle sera activée une
route à la fois, avec schéma, nettoyage utilisateur, test de remontage et gate
humain propres à chaque route. Aucune partie de cette phase 2 ne doit être
réintroduite avant l'accord.
