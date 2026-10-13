# Architecture MVP

## Decisions

- Le site public vit dans `apps/landing` avec Astro.
- L'application existante vit dans `apps/pwa`, avec l'app Expo a la racine de ce dossier et le backend Rust historique dans `fitness-service/`.
- Le frontend reprend le squelette `filfinance-client` : Expo Router, NativeWind, layout responsive avec side menu, theme clair/sombre et navigation par vues.
- L'auth cible est Supabase Auth email/mot de passe. Une session locale de demo garde le MVP accessible tant que Supabase n'est pas configure.
- Le backend est Rust + Axum + SQLx + Postgres. Les features sont separees en `catalog`, `profiles`, `programs` et `ai`.
- Burn est present cote backend comme frontiere du futur generateur IA. Le generateur actuel reste deterministe pour respecter les garde-fous documentes.
- La production frontend utilise deux projets Cloudflare Pages publies depuis
  `main` : la landing sur `acrea-fitness.fr` et la PWA sur
  `app.acrea-fitness.fr`.
- Le backend public cible `acrea-fitness-api.sbcenter.fr` via le reverse proxy
  Traefik. Le contrat des origines est dans `PRODUCTION-URLS.md`.
- Le développement actuel reste local pour le front et le backend.
- L'application cible est une PWA offline-first. SQLite est toujours disponible cote frontend et devient la source locale obligatoire pour les donnees du catalogue, affichees cote public comme Bibliothèque.
- Le backend ne doit pas etre requis pour afficher la bibliothèque au runtime. Supabase sert de source distante de synchronisation du catalogue quand il est configure.
- Les exercices doivent utiliser un modele canonique unique entre backend, SQLite et UI.

## Contraintes issues des docs

- Aucun programme ne demarre sans niveau de depart.
- Chaque semaine contient renforcement, Cardio et proprioception.
- Le mode strict signale que le tirage sans support est limite.
- Les niveaux avances, all-out, sprint, kettlebell technique et AMRAP avance ne sont pas proposes aux debutants.
- Le suivi doit conserver reps, temps, repos, RPE, douleur et notes.
- Les exercices seed doivent etre charges dans SQLite par migration locale. Ils ne doivent pas servir de fallback memoire.
- La synchronisation Supabase du catalogue est quotidienne au maximum: si Supabase est indisponible, l'app conserve les donnees SQLite et reste utilisable offline.

## Regles base/UI

- Les tables applicatives utilisent toujours un `id` numerique auto-incremente.
- Exception : `public.user_profiles.id` reste un UUID Supabase Auth.
- Les cles metier textuelles s'appellent `code`; elles ne sont pas des IDs, ne servent pas de FK et ne sont pas affichees cote client.
- Aucun ID technique ne doit etre rendu dans les vues publiques ou admin.
- Les formulaires admin choisissent les relations par libelle, pas par saisie d'ID.
- Toute table Supabase exposee doit declarer explicitement ses `grant`, RLS et policies dans la migration.

## Authentification et rôles

- Supabase Auth porte l'identité et le rôle PostgreSQL technique `authenticated`.
- `public.user_profiles.account_type` porte le rôle applicatif `basic`,
  `premium` ou `admin`.
- `admin` hérite des capacités premium et ouvre l'administration catalogue.
- Les rôles ne sont stockés ni dans SQLite ni dans `user_metadata`.
- Toute erreur de lecture du profil retire les capacités premium/admin sans
  invalider la session.
- Les promotions sont réalisées par SQL ou service role, jamais par le client.
- Le contrat détaillé est dans `docs/app/auth/roles-et-profils.md`.

## Textes de l'application

- Les textes visibles dans l'application doivent être écrits en français correct, avec les accents.
- L'interface ne doit pas expliquer les choix métier, les arbitrages produit, les sources d'inspiration ou la taxonomie interne. Ces explications restent dans `docs/`.
- Dans l'application, parler directement de ACREA, des 3 piliers, des exercices, des niveaux, des programmes hebdomadaires, de la progression, du test d'evaluation et du parcours de séance du jour, des sessions avec des formats d'exercices, des séries, des répétitions, des intervalles, des repos.

## Frontend feature-first

```text
src/
  application/       layout, routes, navigation
  features/
    auth/
    home/
    level-test/
    profile/
    programming/     seed ACREA, calcul test, plan semaine
    training/
    catalog/          lecture Bibliothèque publique et admin CRUD catalogue
  shared/            config, db SQLite, theme, UI
```

## PWA offline SQLite

- SQLite est la source de lecture locale de la bibliothèque d'exercices.
- L'UI Bibliothèque ne doit pas appeler directement `fetch()` pour afficher les exercices.
- Un service de synchronisation peut lire Supabase via `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, puis upsert les donnees dans SQLite.
- La derniere tentative, le dernier succes et la derniere erreur de synchronisation doivent etre stockes dans une table locale de metadata.
- Si la derniere synchronisation reussie date de moins de 24 heures, l'app ne relance pas de sync catalogue automatique.
- Si Supabase est indisponible, l'echec est journalise localement mais l'app ne bloque pas l'utilisateur.
- Les migrations SQLite locales doivent inserer les exercices seed de facon idempotente.
- L'enveloppe PWA web est configuree avec manifest, icones, service worker genere
  apres export, page offline statique, diagnostics et ecran `Parametres`.
- Le service worker cache les documents en network first, les assets hashes en
  cache first, et bypass les API/auth. Les caches sont prefixes
  `acrea-fitness-*` et versionnes.
- Les mises a jour sont optionnelles en v1 : l'utilisateur active le nouveau
  service worker depuis le prompt `Mettre a jour`.

## Backend feature-first

```text
fitness-service/src/
  features/
    ai/
    catalog/
    level_tests/
    profiles/
    programs/
  shared/
    config.rs
    error.rs
    state.rs
```
