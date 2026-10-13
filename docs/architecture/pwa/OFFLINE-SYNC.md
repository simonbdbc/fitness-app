# Offline et synchronisation SQLite / Supabase

## Principe

SQLite est la source locale obligatoire pour la lecture offline du catalogue.
Supabase Postgres est la source distante et la source d'autorisation des rôles.

Au démarrage, le catalogue SQLite est initialisé avec le seed local. Quand une
synchronisation distante réussit, le snapshot Supabase remplace le cache local.
Une panne Supabase ne bloque pas la lecture du dernier catalogue SQLite connu.

## Runtime SQLite web

`expo-sqlite` utilise un worker WASM, `SharedArrayBuffer` et OPFS sur le web.
Metro et l'hebergement doivent donc servir toutes les pages avec
`Cross-Origin-Embedder-Policy: credentialless` et
`Cross-Origin-Opener-Policy: same-origin`. La validation PWA controle ces
en-tetes dans l'artefact Cloudflare Pages.

Une seule instance navigateur detient le verrou d'acces OPFS. Une seconde
instance affiche un etat bloque explicite au lieu d'ouvrir simultanement la
meme base locale.

Les migrations SQLite sont executees dans une transaction, avec les cles
etrangeres temporairement desactivees puis toujours reactivees. Le controle
`foreign_key_check` precede la mise a jour de `user_version` : un echec restaure
le schema et conserve la version source. Une application plus ancienne refuse
une base dont `user_version` est plus recente afin d'eviter un downgrade.

## Rôles et connexion

La session Supabase authentifie l'utilisateur. `user_profiles.account_type`
détermine ensuite les capacités basic, premium et admin.

Les rôles ne sont jamais persistés dans SQLite. Si le profil distant ne peut
pas être vérifié, la session reste active avec les seules capacités basic.

`networkStatus` décrit la disponibilité Supabase. `apiStatus` décrit séparément
le backend configuré par `EXPO_PUBLIC_API_BASE_URL`.

## Lecture et synchronisation

`ensureCatalogReady()` ouvre SQLite, applique le schéma local et insère le seed
si le catalogue est vide.

`syncCatalogOnForeground()` tente au plus une synchronisation quotidienne.
`syncCatalogFromRemoteNow()` force une tentative. Une synchronisation réussie :

1. lit le snapshot Supabase ;
2. remplace le catalogue SQLite ;
3. met à jour les dates de tentative et de succès ;
4. efface la dernière erreur.

Une synchronisation échouée conserve le cache existant et enregistre l'erreur.

## Mutations admin

Le backend de persistance dépend du runtime :

- local/dev : mutations dans SQLite ;
- hors runtime local : mutations dans Supabase sous RLS, relecture du snapshot,
  puis tentative de remplacement du cache SQLite.

Hors runtime local, le snapshot Supabase est affiche des qu'il est valide. Une
erreur d'ecriture du cache SQLite reste non bloquante pour l'admin et est
journalisee dans la console ; elle ne doit pas transformer une lecture ou une
mutation Supabase reussie en erreur catalogue.

Les pages couvertes sont sessions, niveaux, formats, séries, répétitions,
intervalles, repos et équipements. La page Exercices reste locale/dev et toute
mutation Supabase correspondante est refusée explicitement.

La sauvegarde d'un template de session et de ses niveaux utilise une RPC
transactionnelle. Les autres tables utilisent les opérations Data API directes
sous policies admin.

Il n'existe aucune file d'attente de mutations admin offline. Une écriture
Supabase exige une connexion et un profil `admin` vérifié.

## Conflits et contraintes

- Le dernier snapshot Supabase chargé fait autorité sur le cache local.
- Les suppressions référencées sont refusées par les clés étrangères.
- Les formats acceptent uniquement `repetitions` ou `intervalles`.
- Les templates de session possèdent au moins un niveau entre 1 et 10.
- La synchronisation reste complète, sans delta par `updated_at`.

## Vérification

```bash
pnpm seed:catalog:check
pnpm db:docs:check
pnpm auth:roles:check
pnpm typecheck
pnpm build:web
```
