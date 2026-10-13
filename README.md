# ACREA Fitness

Application de programmes d'entraînement avec catalogue bilingue, profils,
évaluation de niveau et cache local PWA. Le tag release-beta-v1.00 et les rapports
historiques ne qualifient pas le SHA courant. Des recettes isolées sont réalisées ;
les droits et la qualification complète de production restent ouverts.
Le développement est sur [GitLab privé](https://gitlab.com/simonbdbc/fitness-app).
Le [miroir GitHub public](https://github.com/simonbdbc/fitness-app) reçoit un export filtré avec un historique public séparé.
Aucune licence globale n'est ajoutée. Les droits du code, fiches, images/audio,
modèles et composants tiers doivent être établis séparément.

## Structure

```text
apps/
  landing/  site public Astro oriente SEO
  pwa/      application Expo Router existante
fitness-service/      backend Rust historique
tts-audio-generator/  outil de generation audio
docs/                 documentation active
```

La landing Astro et la PWA sont deployees separement. La landing renvoie vers
les routes applicatives `/home` et `/login` sur le domaine de la PWA.

## Commandes

Prérequis : Node 24 (24.18.0 testé), pnpm 11.7.0 défini par les package.json et
lockfiles, Python 3. Rust/Cargo servent aux outils Rust ; Docker et Supabase CLI
sont requis pour Auth/PostgREST local. Expo/PWA et Astro ont des installations et
artefacts indépendants.

```bash
git clone https://github.com/simonbdbc/fitness-app.git
cd fitness-app
cp apps/pwa/.env.example apps/pwa/.env
cp apps/landing/.env.example apps/landing/.env
```

Les exemples sont fictifs. EXPO_PUBLIC_* et PUBLIC_* sont inclus dans les bundles :
aucun service_role, secret JWT, SMTP ou credential serveur ne doit s'y trouver.
Les clés publishable Supabase sont publiques ; utiliser celles de votre instance
locale pour Auth réel. DATABASE_URL appartient au backend.
Voir [sécurité et recette isolée](docs/SECURITY-PUBLICATION.md).

Depuis la racine du depot :

```bash
pnpm run setup
```

Cette commande installe les deux frontends avec leurs lockfiles puis verifie
les configurations Expo, TypeScript et NativeWind utilisees par la PWA.

```bash
pnpm dev:landing
pnpm build:landing
pnpm preview:landing
pnpm dev:pwa
pnpm build:pwa
pnpm typecheck:pwa
pnpm validate:pwa
pnpm build:frontends
pnpm tooling:check
```

`pnpm build:frontends` construit les deux artefacts independants dans
`apps/landing/dist/` et `apps/pwa/dist/`.

## Recette, persistance et arrêt

Lancer `pnpm dev:landing` et `pnpm web:pwa` dans deux terminaux avec comptes et
profils fictifs. Le build ne prouve ni Auth distant, ni offline ou mobile natif.

```bash
pnpm --dir apps/pwa auth:test
pnpm --dir apps/pwa catalog:boundary:test
```

Dans la source privée complète, le test Python crée son PostgreSQL sans TCP, simule Auth et n'accepte aucune URL
de base. `auth:roles:check` exige Supabase local préparé et refuse les hôtes distants.
La recette Auth/PostgREST a été exécutée sur Supabase local avec les comptes
synthétiques `example.test` du seed : accès intercomptes et élévation de rôle
refusés, accès légitimes et RPC catalogue vérifiés. Les 15 tests navigateur
existants ont aussi réussi avec Auth/API simulés ; ils ne valident pas une
connexion navigateur à Supabase réel, le mobile natif ou la production.
Les preuves datées de préparation restent distinctes de la qualification du
futur export public après exclusions.
Arrêter les serveurs avec Ctrl+C et Supabase local avec `supabase stop` depuis
son dossier. Le cache SQLite navigateur et les volumes persistent ; un arrêt
n'efface pas les profils. Ne pas ajouter de reset/drop/suppression de volumes
pour arrêter. Les migrations avec reset sont réservées aux instances jetables ;
leur usage en production exige une procédure et une autorisation explicites.

## Deploiement

Les destinations ci-dessous sont celles de la configuration suivie ; elles ne
constituent pas une vérification du déploiement courant. Aucune commande de
publication n'est nécessaire pour la recette locale.

Le deploiement utilise deux projets Cloudflare Pages :

- `acrea-fitness` publie `apps/landing/dist/` sur
  `https://acrea-fitness.fr` ;
- `acrea-fitness-app` publie `apps/pwa/dist/` sur
  `https://app.acrea-fitness.fr`.

Le pipeline GitLab CI construit, valide puis déploie les deux frontends avec
Wrangler dans le job unique `release_production`. Aucun fichier
`wrangler.toml` n'est conservé dans le dépôt. L'API cible est
`https://acrea-fitness-api.sbcenter.fr`. Le contrat de bascule est documente
dans `docs/architecture/PRODUCTION-URLS.md`.

## Points de vigilance

- Les routes applicatives internes restent dans `apps/pwa/app/`.
- Les variables Expo publiques restent dans `apps/pwa/.env`.
- La route signup n'existe pas actuellement ; la landing pointe vers les URLs
  absolues `/home` et `/login` du domaine applicatif.
- `docs/README.md` définit l'ordre de préséance documentaire et
  `docs/ROADMAP.md` porte l'état de livraison.
- Cet export contient uniquement les six exercices du contrat d’évaluation V4,
  leurs fiches FR/EN et leurs douze médias. Le catalogue complet, les fiches
  incomplètes et les anciennes données d’exercices restent dans GitLab privé.
- Les référentiels structurels (formats, équipements, durées) restent présents ;
  ils ne contiennent pas les fiches du catalogue complet.
- Les migrations SQL sont des sources de présentation filtrées. Les anciens
  seeds d’exercices et certains patches de catalogue de production sont exclus :
  ce dépôt ne reproduit pas la chaîne complète de migration de production.

## Synchronisation du dépôt de présentation

Destination de cet export réduit : https://github.com/simonbdbc/fitness-app. Son historique est séparé de l’historique privé GitLab. Le job de publication exporte les fichiers autorisés depuis la branche dédiée `publication/github-main`, contrôle le contenu puis ajoute un commit à la suite du dernier commit public. Les anciennes branches, étiquettes, données privées et artefacts internes ne sont pas transférés. Les propositions de modification sont revues dans GitLab avant publication. La synchronisation est suspendue pendant la correction du périmètre public. Aucun déploiement applicatif n’est autorisé.
