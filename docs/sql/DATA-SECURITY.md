# Securite des donnees

## Catalogue utilise en production

Le catalogue commence a porter des decisions et corrections faites en base,
notamment les statuts de revision (`catalog_exercises.review_status`) et les
editions admin.

A partir de maintenant, un seed complet du catalogue ne doit plus etre applique
sur une base utilisee sans action directe et explicite du proprietaire du projet.

## Regle non negociable

Interdit en production sans validation manuelle explicite :

- executer un seed complet du catalogue ;
- executer `supabase db push --include-seed` ;
- executer un `db reset` ou equivalent sur une base distante utilisee ;
- rejouer une migration qui upsert massivement `public.catalog_exercises` ;
- lancer un script qui ecrase `catalog_exercises.review_status`, `is_active` ou des donnees admin non seed.
- placer un script marque `Local only` ou un reset global du schema `public`
  dans `supabase/migrations`.

Autorise sans seed complet :

- appliquer une migration additive ciblee ;
- creer de nouvelles tables ;
- ajouter des index, contraintes, grants ou policies ;
- inserer des donnees dans de nouvelles tables quand la migration ne modifie pas les lignes metier deja editees.
- rattraper un petit nombre de lignes catalogue manquantes avec une migration
  explicite et idempotente, sans update massif.

## Regle identifiants et exposition Supabase

- Les tables applicatives utilisent `id` numerique auto-incremente.
- Les cles metier `code` sont textuelles, mais ne sont pas des IDs et
  ne doivent pas etre utilisees comme FK.
- Aucun ID technique ne doit etre expose dans l'UI publique ou admin.
- Toute nouvelle table `public.*` exposee au client doit avoir un `grant`
  explicite, RLS activee et des policies dans la meme migration.
- Cette regle suit le changement Supabase 2026 : les nouvelles tables du schema
  `public` ne sont plus exposees automatiquement a l'API sans privileges
  explicites.

## Rôles et profils

- `auth.users` porte l'identité; `public.user_profiles` porte le rôle
  applicatif.
- Tout nouveau profil reçoit `basic` par défaut.
- `account_type` et `email` ne sont jamais modifiables avec la clé publishable.
- Le propriétaire peut lire son profil et modifier uniquement `display_name`.
- Les rôles ne doivent jamais être déterminés depuis `user_metadata` ou SQLite.
- `private.is_admin()` reste dans un schéma non exposé, utilise un
  `search_path` vide et n'est exécutable que par `authenticated`.
- Les grants d'écriture catalogue ne suffisent pas seuls : chaque table doit
  aussi avoir une policy vérifiant `private.is_admin()`.
- Une clé service role ne doit jamais être incluse dans le frontend ou un
  fichier public Expo.

## Reset seed

La strategie reset seed est autorisee pour les schemas/seeds generes locaux et
les environnements jetables. Elle ne change pas la regle de production : pas de
`db reset`, pas de seed complet et pas d'upsert massif sans validation manuelle
explicite du proprietaire.

Le reset local reste dans `supabase/reset-local-format-schema.sql`. Le
validateur `db:docs:check` refuse tout nouveau reset destructif dans le dossier
des migrations actives. La migration historique du 8 juillet 2026 reste
toleree uniquement pour ne pas falsifier l'historique deja applique.

## Controle production en lecture seule

`pnpm catalog:remote:check` utilise uniquement la cle publishable. Il compare
les tables catalogue distantes au seed valide et ne modifie aucune ligne. Ce
controle est execute manuellement apres une migration catalogue ; la CI
applicative ne se connecte a aucune base distante.

Le bootstrap initial de production est une exception versionnee : la migration
`bootstrap_empty_catalog` verifie que la somme des lignes des 15 tables vaut
zero avant d'executer une copie exacte de `supabase/seed.sql`. Elle echoue sur
un catalogue partiel ou deja initialise et ne constitue pas un mecanisme de
mise a jour recurrent.

## Procedure d'exception

Un seed complet du catalogue ne peut etre applique que si toutes les conditions
suivantes sont remplies :

- demande explicite du proprietaire du projet dans le fil de travail ;
- sauvegarde SQL des tables impactees avant action ;
- comparaison avant/apres des colonnes sensibles ;
- plan de rollback documente ;
- validation manuelle du resultat avant de deployer le client.

## Migration Supabase niveaux/formats

Commande interdite pour cette migration :

```bash
supabase db push --linked --include-seed
```

Commande attendue :

```bash
supabase db push --linked
```

Avant application, faire un dry-run et verifier que seule la migration attendue
est listee :

```bash
cd apps/pwa
supabase migration list --linked
supabase db push --linked --dry-run
```

Ne pas utiliser `--include-all` sauf decision explicite apres lecture de
`supabase migration list --linked`. Ne pas utiliser `--include-seed`.

Appliquer ensuite uniquement si le dry-run liste la migration attendue :

```bash
supabase db push --linked
```

Avant et apres application, verifier que les statuts de revision n'ont pas
bouge :

```sql
select review_status, count(*)
from public.catalog_exercises
group by review_status
order by review_status;
```

Verifier aussi que la migration n'a pas transforme un changement admin en ligne
seed :

```sql
select count(*) as non_seed_exercises
from public.catalog_exercises
where source_status not like 'seed%';
```

Ne pas appliquer une migration versionnee avec l'editeur SQL : cela
desynchroniserait l'historique distant. Utiliser exclusivement
`supabase db push --linked` apres verification du dry-run. `migration repair`
est interdit en production.

## Rattrapages ciblés acceptes

Les rattrapages ponctuels doivent rester explicites, auditables et idempotents :

- identifier d'abord l'ecart exact entre le seed local et Supabase ;
- generer une migration dediee pour les seules lignes manquantes ;
- utiliser `on conflict do nothing` pour les exercices afin de ne pas ecraser
  un statut de revision cree entre-temps ;
- verifier par dry-run, puis par compteurs apres application.
