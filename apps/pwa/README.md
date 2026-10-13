# ACREA Fitness — application Expo/PWA

Application de préparation et suivi de séances, avec bibliothèque d’exercices, profils, programmes et authentification Supabase. Ce composant Expo est distinct du backend Rust historique. La préparation de publication ne constitue pas une qualification globale de release ou de production.

## Prérequis et installation

Utiliser Node 24 et pnpm 11.7.0. Depuis la racine du dépôt privé :

```sh
pnpm run setup
cp apps/pwa/.env.example apps/pwa/.env
pnpm web:pwa
```

Le développement reste sur GitLab ; GitHub est une destination future. Le modèle d’environnement est fictif. Pour exercer l’authentification et les données, préparer une instance Supabase isolée avec migrations et seed synthétique suivant [le guide de sécurité](../../docs/SECURITY-PUBLICATION.md). Ne pas copier une configuration de production ou une clé serveur dans le client.

## Configuration et données

Les variables EXPO_PUBLIC sont visibles par le navigateur. Elles doivent seulement décrire le client et son endpoint autorisé ; service_role, credentials SMTP, mots de passe de base et clés privées restent hors bundle/Git. RLS, rôle et RPC sont des contrôles serveur : une interface masquant un bouton ne remplace pas ces contrôles.

Les migrations et le seed de démonstration sont sous `supabase/`. Les comptes de recette example.test sont synthétiques. Les exercices et médias historiques ont des droits/provenances encore à confirmer ; leur présence dans un build privé n’autorise pas leur publication.

## Build et contrôles locaux

Depuis ce dossier :

```sh
pnpm component:test
pnpm typecheck
pnpm pwa:contract:test
pnpm auth:test
pnpm build:web
pnpm validate:pwa
```

Vitest 4.1.11 exécute les composants en jsdom ; clearMocks remet les compteurs à zéro entre tests, restoreMocks restaure les spies. Les types Node sont explicites pour les tests SQLite. Aucun pool Tinypool n’est retenu par ce moteur de tests. Playwright 1.55.1 sert aux E2E ; son exécution exige un navigateur installé et le build courant. Les mocks E2E restent distincts des tests Auth/PostgREST réels et de la production.

Le build contrôle la bibliothèque qualifiée puis produit `dist/`. Les validations de génération ne prouvent pas les droits des contenus. Arrêter les serveurs locaux avec Ctrl+C ; conserver bases et données uniquement dans l’environnement privé de recette.

## Limites et publication

Les preuves sont liées aux SHA dans le dossier de pilotage. Compilation, composants simulés, navigateur, Supabase isolé et production sont des niveaux différents. Les licences, médias, données et exclusions doivent être décidés et le contenu exporté doit être testé avant un candidat public. Aucune nouvelle licence, fusion, migration de production ou activation de miroir n’est fournie par cette recette.
