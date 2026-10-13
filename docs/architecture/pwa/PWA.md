# PWA ACREA Fitness

Document projet derive du contrat neutre
[`docs/PWA-CONTRACT.md`](./PWA-CONTRACT.md). Le contrat reste la reference
produit/technique generique ; ce fichier trace les choix ACREA Fitness, les ecarts
assumes et la validation locale.

## Etat de conformite

Statut courant : `Correctif phase 1 V2 en validation humaine`.

Le statut `Valide` demandera encore la QA manuelle multi-navigateurs :
installation Chromium desktop, Android Chromium, instructions iOS/iPadOS,
offline, update N -> N+1 avec onglet deja ouvert, nettoyage caches,
desinstallation/reinstallation.

Checklist projet :

| Sujet | Etat | Notes |
|---|---|---|
| Manifest, icones, metadata HTML | Conforme | `id` et `start_url` stables sur `/`, captures desktop/mobile, genere et valide par `pnpm build:web` puis `pnpm validate:pwa`. |
| Installation | Conforme | Capture precoce de `beforeinstallprompt`, `InstallAppBanner`, `InstallAppButton`, route `/install`, instructions manuelles iOS. |
| Mode installe | À revalider | Detection `browser`, `standalone`, `fullscreen`, `minimal-ui`, `unknown` ; reprise réelle Timer/Entraînement en attente de validation humaine. |
| Service worker | Conforme avec decision projet | Offline-first, `clients.claim()` volontaire, `skipWaiting()` sur action utilisateur uniquement. |
| Mise a jour | Conforme v1 | Update optionnelle via prompt, activation controlee par `Mettre a jour`. |
| Rollback | Conforme v1 | Retention assets courants + precedents, pas de migration locale irreversible sans version majeure. |
| Desinstallation | Conforme | Route `/uninstall`, aide navigateur/OS, nettoyage caches PWA seulement. |
| Diagnostics | Conforme | Version, caches, SW, manifest, stockage et build exposés dans `/settings`. |
| Observabilite | Conforme v1 | `trackPwaEvent`, console en dev, no-op prod sans endpoint. |
| CSP | Conforme v1 | `Content-Security-Policy-Report-Only` dans `_headers`, durcissement progressif. |

## Origines et metadata

- Production : `https://app.acrea-fitness.fr`.
- Landing publique : `https://acrea-fitness.fr`.
- API cible : `https://acrea-fitness-api.sbcenter.fr`, non activee tant que
  DNS, TLS et `/health` ne sont pas valides.
- Preview : origine Cloudflare Pages de la branche.
- Local : `localhost` ou `127.0.0.1`.
- Manifest : `/manifest.webmanifest`.
- Point de demarrage installe : `/`, sans redirection HTTP. Une ouverture
  froide authentifiée rejoint `/home` ; le manifeste ne déclare aucun
  `launch_handler` et le shell ne tente pas de reconstruire une route.
- Service worker : `/service-worker.js`.
- Version runtime : `/pwa-build.json`.
- Support par defaut : `support@acrea-fitness.fr`.

Variables publiques utiles :

```text
EXPO_PUBLIC_APP_ORIGIN
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_RELEASE_CHANNEL
EXPO_PUBLIC_SUPPORT_CONTACT
EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT
```

`EXPO_PUBLIC_API_BASE_URL` est optionnel. Sans valeur, aucun probe API n'est
emis et le diagnostic indique `API non configuree`. La variable ne doit etre
definie qu'apres validation DNS, TLS et HTTP 200 de `/health`.

`EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT` est optionnel. Sans valeur, aucun appel
reseau analytics n'est emis en production.

## Routes et composants

Routes PWA protegees :

- `/settings` : preferences et acces au tableau de bord PWA.
- `/pwa` : tableau de bord PWA, version, stockage, diagnostics et update.
- `/install` : bouton natif et procedures desktop, Android et iOS/iPadOS.
- `/uninstall` : procedures de desinstallation OS/navigateur et de
  reinstallation propre.
- `/offline` : ecran offline hors groupe protege.

Composants PWA actifs :

- `InstallAppBanner`
- `InstallAppButton`
- `MenuInstallButton`
- `UpdateAvailablePrompt`
- `OfflineScreen`
- `ConnectionStatus`
- `StorageUsagePanel`
- `AppVersionInfo`
- `PwaDiagnosticsScreen`

`ConnectionStatus` affiche deux badges :

- reseau Supabase : `Connecté` si `EXPO_PUBLIC_SUPABASE_URL/auth/v1/health`
  repond, sinon `Hors ligne` ;
- API backend : `API` en vert si `EXPO_PUBLIC_API_BASE_URL/health` repond,
  `API` en rouge si le service configure est indisponible, et statut non
  configure si la variable est absente.

Ces deux etats sont independants. Un backend indisponible ne doit pas afficher
le reseau Supabase comme hors ligne.

`MenuInstallButton` utilise le contexte PWA :

- update ou installation a gerer -> `/pwa` ;
- application deja installee ou mode standalone/fullscreen/minimal-ui ->
  bouton masque.

## Reprise de navigation et de séance

La phase 1 conserve strictement les minuteurs de `f5cd675`, dernier état validé
par observation réelle. Un passage arrière-plan → premier plan n'a aucun droit
de navigation : si le document reste monté, Expo Router conserve l'URL et
l'écran courants.

Les validations humaines de `087cc45b` puis `1eda0ad3` ont montré que les
tentatives postérieures de checkpoint de route, de `launch_handler` et de
persistance globale du scroll n'ont pas corrigé la reprise installée de manière
stable. Ces mécanismes sont retirés pendant la phase 1. Le shell ne possède
aucun listener de visibilité et aucune logique de navigation : il laisse le
document monté et Expo Router conserver naturellement la route courante. Si
l'OS détruit réellement le document, il s'agit d'un nouveau démarrage et `/`
ouvre `/home` conformément au contrat produit.

Le Minuteur écoute directement `visibilitychange` sur Web et `AppState` sur
natif. Son snapshot AsyncStorage conserve la clé historique
`acrea-fitness.session-timer.v2`, le plan, le temps écoulé, la série et la
récupération. La restauration finit avant toute écriture initiale ; un snapshot
`running` ou `countdown` relu après remontage revient en pause, sans rattrapage du
temps passé hors écran. Un plan incompatible invalide uniquement ce snapshot.

L'Entraînement réutilise exactement ce minuteur pour ses exercices et ses
récupérations. Comme dans `f5cd675`, la séance guidée, son index et ses
feedbacks relisent synchroniquement les clés Web historiques dans
`window.localStorage`. Aucun coordinateur lifecycle global, signal
`foregroundRevision`, checkpoint de route, persistance générique d'écran ou
rafraîchissement automatique n'est actif dans cette phase.

La vérification de release catalogue est limitée à l'ouverture de la
Bibliothèque. Elle n'est plus abonnée globalement à `AppState` depuis le layout
protégé et ne peut donc pas lancer de travail SQLite au réveil de Timer ou
Entraînement.

Le déroulé complet, le point d'arrêt et la matrice de validation humaine sont
décrits dans
[`PERSISTENCE-RECOVERY-PLAN.md`](./PERSISTENCE-RECOVERY-PLAN.md). La
généralisation route par route est explicitement bloquée jusqu'à l'acceptation
humaine de Timer et Entraînement sur une PWA installée.

## Service worker et cache

La strategie retenue est `Avec service worker`.

Le service worker est genere apres `expo export` par
`scripts/prepare-cloudflare-pages.mjs`, a partir des fichiers reels du dossier
`dist/`.

Caches :

```text
acrea-fitness-shell-v[APP_VERSION]
acrea-fitness-assets-v[APP_VERSION]-[BUILD_ID]
acrea-fitness-runtime-v[BUILD_ID]
```

Strategies :

- Documents HTML : network first, fallback shell, puis `/offline.html`.
- JS/CSS/WASM/images hashes Expo : cache first.
- Manifest, page offline, icones et build info : precache.
- API, auth, OIDC/OAuth et ecritures : bypass cache.
- Caches `shell` et `runtime` obsoletes : supprimes pendant `activate`.
- Caches `assets` : conservation d'au moins deux versions pour proteger les
  pages anciennes encore ouvertes.

`clients.claim()` est conserve volontairement. Justification :

- l'application est offline-first ;
- les diagnostics et la version ont besoin d'un controller rapidement
  disponible ;
- apres activation, le controle SW doit etre coherent sans attendre une
  navigation complete.

Contrainte associee : ne jamais supprimer agressivement des assets encore
necessaires a une page ancienne. Si un futur changement rend les anciens assets
ou donnees locales incompatibles, la release doit etre traitee comme une version
majeure avec migration, fenetre de transition et rollback documente.

`skipWaiting()` reste declenche uniquement par message `SKIP_WAITING`, lui-meme
envoye apres action utilisateur `Mettre a jour`.

## Installation et desinstallation

L'application distingue :

- installable via `beforeinstallprompt` ;
- deja installee via display mode standalone/fullscreen/minimal-ui ;
- installation manuelle iOS/iPadOS ;
- navigateur non supporte ;
- prompt masque apres refus.

`/install-prompt-bridge.js` est charge dans le `<head>` avant l'application. Il
capture `beforeinstallprompt`, appelle `preventDefault()` et conserve l'evenement
jusqu'au montage React. Cette capture evite de perdre le prompt lorsque Brave ou
un autre navigateur Chromium le declenche avant l'initialisation des providers.

Le rejet de la banniere d'installation est memorise 14 jours dans
`localStorage`, mais il ne desactive pas le bouton permanent du tableau de bord
tant que le navigateur expose encore un prompt valide.

L'element HTML experimental `<install>` est utilise en amelioration progressive
uniquement lorsque `HTMLInstallElement` existe. En juillet 2026, il reste limite
a Chrome/Edge 148+ avec flag ou Origin Trial 148-153. Brave et les autres
navigateurs conservent le flux stable `beforeinstallprompt`; aucun Origin Trial
n'est requis pour installer ACREA Fitness.

Le manifest fournit une `description`, une capture `wide` et une capture mobile
afin d'activer l'interface d'installation enrichie sur les navigateurs
compatibles. Le libelle applicatif principal reste `Installer`.

References de mise en oeuvre :

- [Element HTML `<install>`](https://developer.chrome.com/blog/install-element-ot?hl=fr)
- [Fonctionnalites d'installation PWA](https://developer.chrome.com/blog/pwa-install-features?hl=fr)
- [Fallback SPA Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering)

La desinstallation est externe a l'app : navigateur, OS ou launcher. ACREA Fitness
fournit une aide neutre et un nettoyage applicatif limite aux caches PWA. La
bibliothèque SQLite et les donnees synchronisees cote serveur sont conserves.

Reinstallation propre conseillee :

1. Supprimer l'icone installee depuis le navigateur ou l'OS.
2. Vider les caches PWA depuis `/pwa`.
3. Recharger l'application dans le navigateur.
4. Relancer l'installation depuis `/install`.

## Mise a jour et rollback

La mise a jour v1 est optionnelle :

- detection via service worker en attente et comparaison du build courant avec
  `/pwa-build.json` ;
- prompt non bloquant ;
- activation apres action utilisateur ;
- reload controle apres activation.

Le mode force est reserve a une future incompatibilite de schema ou a un risque
securite concret.

Rollback Cloudflare Pages :

1. Redeployer le dernier artefact stable ou restaurer le deploiement stable via
   Cloudflare Pages.
2. Garder les assets hashes de la version stable et de la version precedente
   tant que des clients peuvent encore servir un ancien shell.
3. Ne pas introduire de migration locale irreversible sans bump majeur et garde
   de compatibilite.
4. Verifier que `/pwa-build.json` expose le build restaure.

## Offline et donnees locales

Le catalogue metier, affiche cote public comme Bibliothèque, reste stocke dans
SQLite local et n'est pas supprime par le nettoyage PWA. Le panneau stockage ne
vide que les caches applicatifs `acrea-fitness-*`.

Les ecritures offline metier ne sont pas supportees en v1. Aucune ecriture n'est
mise en file d'attente silencieuse.

## Observabilite et analytics

`trackPwaEvent` centralise les evenements PWA principaux :

- cycle de vie `pwa_app_start`, `pwa_app_background` et
  `pwa_app_foreground`, observe via `visibilitychange` sans `focus`/`blur` ;
- prompt d'installation disponible, accepte, masque ou en erreur ;
- installation detectee ;
- changement de mode d'affichage ;
- changement reseau ;
- service worker enregistre, en attente, en erreur ou controller change ;
- update disponible, appliquee, reportee ou en erreur ;
- diagnostics actualises ;
- nettoyage caches demarre, termine ou echoue.

Politique v1 :

- developpement : `console.info("[pwa]", event)` ;
- production sans endpoint : no-op ;
- production avec `EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT` : emission best-effort
  via `sendBeacon` puis `fetch(..., keepalive: true)`.

Les payloads ne doivent contenir ni token, ni donnee personnelle, ni contenu
metier sensible. Les evenements sont destines au support, a la QA et au suivi de
fiabilite PWA, pas a un profilage utilisateur.

## CSP

`public/_headers` declare une CSP en mode :

```text
Content-Security-Policy-Report-Only
```

Objectifs :

- detecter les dependances necessaires avant blocage ;
- documenter les sources attendues pour scripts, styles, images, fonts,
  workers, manifest et connexions ;
- preparer un passage ulterieur vers `Content-Security-Policy` strict apres
  analyse des rapports.

La CSP v1 reste volontairement `Report-Only` pour ne pas bloquer Supabase, Expo web
ou les flux PWA tant que les rapports n'ont pas ete verifies en production.

## Validation

Commandes :

```bash
source ~/.nvm/nvm.sh
nvm use --lts
pnpm timer:test
pnpm component:test
pnpm architecture:test
pnpm typecheck
pnpm build:web
pnpm e2e:test
pnpm validate:pwa
```

Matrice automatisée de phase 1 rejouée le 14 août 2026 : 15/15 tests machine,
75/75 tests composants, 5/5 contrats d'architecture, 19/19 contrats PWA/API,
typecheck, build Web frais, validation PWA et 13/13 scénarios E2E avec service
workers actifs. Elle verrouille par SHA-256 vingt fichiers couvrant l'enveloppe
PWA, le Minuteur et l'Entraînement de `f5cd675`, puis vérifie la restauration
AsyncStorage des minuteurs, la reprise Web historique de la séance guidée et l'absence de
navigation au simple événement de visibilité. Ces résultats ne valent pas
validation d'une PWA réellement suspendue par l'OS : la QA humaine décrite dans
le plan reste le gate final.

Controles post-build :

- le manifest utilise `start_url: "/"`, ne déclare aucun `launch_handler` et
  contient les captures desktop/mobile ;
- le bridge d'installation est present dans le HTML et le precache ;
- `_redirects` ne reecrit aucune route vers `/index.html` ;
- aucun `404.html` racine ne desactive le fallback SPA automatique de
  Cloudflare Pages ;
- `dist/service-worker.js` contient `clients.claim()`.
- `skipWaiting()` n'est appele que pour le message `SKIP_WAITING`.
- `dist/service-worker.js` contient `RETAINED_ASSET_CACHE_COUNT`.
- `_headers` contient `Content-Security-Policy-Report-Only`.

QA manuelle minimale :

- Desktop Brave/Chromium : prompt capture, installation, lancement standalone,
  update optionnelle,
  suppression caches, reinstallation.
- Android Chromium : installation et page offline.
- iOS/iPadOS Safari : instructions d'ajout a l'ecran d'accueil.
- Navigateur non compatible : app web normale, pas de promesse d'installation.
- Offline : chargement d'une route precachee, fallback `/offline.html`,
  bibliothèque depuis SQLite si la session locale est disponible.
- Update N -> N+1 : onglet deja ouvert, prompt, activation utilisateur,
  conservation des assets necessaires a l'ancien shell.
