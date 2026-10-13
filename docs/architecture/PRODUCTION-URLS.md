# URLs de production

## Contrat

| Service | URL | Deploiement |
|---|---|---|
| Landing Astro | `https://acrea-fitness.fr` | Cloudflare Pages `acrea-fitness` |
| Application PWA | `https://app.acrea-fitness.fr` | Cloudflare Pages `acrea-fitness-app` |
| API Rust | `https://acrea-fitness-api.sbcenter.fr` | Cible Traefik, activation apres validation DNS/TLS |
| Messagerie | `mail.sbcenter.fr` | Stalwart entrant ; Brevo pour les envois externes et Auth Supabase |

Les anciens domaines `fitness.sbcenter.fr` et `fitness-api.sbcenter.fr` sont
retirés sans alias et sans redirection.

## Cloudflare Pages

1. Creer ou verifier les projets Pages `acrea-fitness` et
   `acrea-fitness-app` avec `main` comme branche de production.
2. Attacher `acrea-fitness.fr` au projet landing.
3. Attacher `app.acrea-fitness.fr` au projet PWA.
4. Conserver `CLOUDFLARE_API_TOKEN` dans les variables GitLab protegees.
5. Laisser GitLab CI construire, valider puis publier les deux répertoires
   `dist/` avec Wrangler dans le job `release_production`.

La configuration Cloudflare de la PWA doit utiliser exactement :

- Root directory : `apps/pwa` ;
- Build output directory : `dist` ;
- Build command : `pnpm build:web && pnpm validate:pwa`.

Le validateur refuse un build `production` sans origine PWA, URL Supabase et
cle publique Supabase. L'origine API reste optionnelle tant que son DNS, son
certificat TLS et `/health` ne sont pas valides. Cette verification empeche de
publier silencieusement la PWA en mode invite sans provoquer de probes vers une
origine inexistante.

Il ne doit exister aucun fichier `wrangler.toml` dans le dépôt. Les noms des
projets et dossiers d'artefacts sont passés directement à
`wrangler pages deploy`. Le job `build_pwa` reste un contrôle obligatoire et
le déploiement des deux surfaces reste atomisé dans un seul job protégé afin
d'éviter les doubles publications.

## API Et Traefik

Le DNS de `acrea-fitness-api.sbcenter.fr` doit pointer vers le reverse proxy de
production. La route Traefik utilise la regle suivante :

```text
Host(`acrea-fitness-api.sbcenter.fr`)
```

Le certificat TLS doit couvrir ce nom et `/health` doit retourner HTTP 200.
Le backend Rust conserve sa configuration CORS actuelle dans cette tranche.
Ne definir `EXPO_PUBLIC_API_BASE_URL` qu'apres ces trois validations. En son
absence, la PWA affiche l'API comme non configuree et ne lance aucun probe.

## Supabase Auth

Dans `Authentication > URL Configuration` :

- definir le Site URL sur `https://app.acrea-fitness.fr` ;
- autoriser les redirections applicatives necessaires sous cette origine ;
- conserver `https://acrea-fitness-app.sbcenter.fr` pendant la recette, puis
  retirer cette origine uniquement apres validation de la connexion.

Aucune cle service role ne doit etre exposee dans GitLab, Astro ou Expo.

## Messagerie transactionnelle

Les e-mails Auth de production sont envoyés par Brevo avec l'expéditeur
`ACREA Fitness <noreply@acrea-fitness.fr>`. Supabase utilise le relais SMTP
Brevo sur le port 587 avec STARTTLS ; les identifiants restent exclusivement
dans sa configuration protégée.

La réception publique de `acrea-fitness.fr` est assurée par Stalwart via le MX
`mail.sbcenter.fr`. Les détails d'architecture, le protocole de vérification et
le retour arrière sont consignés dans
[MAIL-PRODUCTION.md](./MAIL-PRODUCTION.md).

## Ordre De Bascule

1. Deployer et valider les deux projets Pages.
2. Configurer le domaine API, TLS et Traefik.
3. Mettre a jour Supabase Auth.
4. Tester landing, PWA, authentification et API.
5. Retirer les anciens domaines et enregistrements DNS sans redirection.
