# Sécurité et recette de publication

[DATA-SECURITY](sql/DATA-SECURITY.md) reste la référence pour grants, RLS,
migrations et production. Une recette locale ne modifie aucun rôle distant.

Le rôle provient de user_profiles, jamais du user_metadata de l'inscription
ni du cache SQLite. Le client modifie uniquement son display_name ; email et
account_type restent privés. Le catalogue V2 des exercices est en lecture seule
via Data API, y compris pour admin. Les mutations autorisées des référentiels
passent par RLS admin ; la RPC de session exige ce rôle et une phase explicite.
Les RPC progressives du catalogue sont réservées aux authentifiés.

Le profil de compte reste limité à son propriétaire ; certaines données métier
autorisent explicitement admin selon leurs politiques. Ne pas extrapoler un
même périmètre à toutes les tables. private.is_admin et la synchronisation des
profils ont un search_path vide et des grants explicites.

## Deux recettes distinctes

```sh
PG_BINDIR=/chemin/vers/postgresql/bin python3 scripts/test-auth-rls.py
```

Le test applique toutes les migrations suivies dans PostgreSQL 17 jetable, privé,
sur socket Unix sans TCP. Il simule auth.users/auth.uid, les rôles et les grants
par défaut Data API. Il vérifie deux comptes fictifs, profil étranger, anonyme et
identité absente, modification propre du nom, refus du rôle/email et du rôle admin
injecté dans metadata, mutations/RPC admin légitimes, RPC invalides atomiques et
refus d'une tentative d'évaluation étrangère. Ce scaffold n'est pas Auth/PostgREST.

Pour l'intégration réelle, préparer Supabase local jetable avec migrations/seeds
suivis dans un dossier dédié, jamais lié à une base distante. Copier uniquement
`apps/pwa/supabase/config.toml`, `migrations/`, `seed.sql` et `demo-user.sql`
vers le sous-dossier `supabase/` de ce dossier. Choisir un `project_id` neuf et
des ports libres dans la copie de config.toml ; ne pas copier `.temp/` ou une
configuration privée. Un dossier de recette existant doit être vérifié avant
toute commande.

Depuis la racine, démarrer la recette minimale Auth/Data API :

```sh
pnpm --dir apps/pwa exec supabase start --workdir /chemin/recette-jetable --exclude analytics,edge-runtime,functions,imgproxy,inbucket,meta,realtime,storage,studio,vector
```

Le premier démarrage applique les migrations et les deux seeds de cette copie.
Les fonctions Edge, Storage et les autres services exclus ne sont pas validés par
cette recette. Consulter le statut dans un terminal privé et renseigner uniquement
l’URL loopback et la clé cliente publique dans `apps/pwa/.env`. Ne pas copier la
clé secrète/service_role dans ce fichier. Puis exécuter :

```sh
pnpm --dir apps/pwa auth:roles:check
SUPABASE_LOCAL_WORKDIR=/chemin/recette-jetable pnpm --dir apps/pwa catalog:progressive:local
```

Arrêter uniquement cette recette :

```sh
pnpm --dir apps/pwa exec supabase stop --workdir /chemin/recette-jetable
``` Ne pas supprimer les volumes d’une autre stack.

Les scripts refusent une cible distante. Les comptes demo/premium/admin sont
synthétiques et les promotions réservées à cette instance locale. Ne jamais
lancer db reset sur une cible distante ni seed global en production pour tester.

## Redistribution

Exclure .env privée, service_role/JWT/SMTP, bases et exports utilisateurs, profils,
journaux et captures privées. Conserver les migrations/tests et leurs canaris
fictifs après revue. Fiches et médias exigent provenance/droits avant rétention ;
leur exclusion nécessite un parcours synthétique compatible avec les générateurs.

Rapports beta historiques, tests/build locaux, tag et MR privée ne prouvent ni
G01, ni droits de redistribution ou état déployé. Aucune licence nouvelle choisie.
