# Migrations Supabase de production

État vérifié le 13 août 2026 : **qualification candidate en NO-GO**. Aucune
migration Supabase distante, écriture de production ou publication Cloudflare
n'a été exécutée pour ce candidat.

L'état réel des migrations d'un environnement cible ne doit jamais être déduit
de ce dépôt : il est établi lors de la fenêtre par un opérateur autorisé avec
une inspection en lecture seule. Une sauvegarde restaurable est obligatoire.

Le seul suffixe de migrations autorisé pour cette bascule est, dans cet ordre :

1. `20260719202256_remove_acrea_profile_defaults.sql`
2. `20260811090000_bilingual_equipment_reference.sql`
3. `20260811100000_exercise_library_v2.sql`
4. `20260812083749_beta_catalog_release_v4.sql`
5. `20260812105130_beta_catalog_v2_seed.sql`
6. `20260812130351_beta_low_impact_fixed_phases.sql`
7. `20260812131751_beta_low_impact_main_candidates.sql`
8. `20260812132122_beta_low_impact_proprioception_candidate.sql`
9. `20260812133824_beta_low_impact_proprioception_entry_candidate.sql`
10. `20260812145000_beta_revoke_anon_v4_mapping_select.sql`
11. `20260813074437_catalog_progressive_delivery.sql`

La cinquième migration est le snapshot versionné et contrôlé du catalogue V2.
Les migrations 6 à 10 sont des correctifs strictement ascendants de
compatibilité faible impact et de privilèges V4. La onzième expose l'index
compact et les fiches demandées à la demande. Elles évitent toute réécriture du
snapshot et toute exécution de seed distant hors historique de migrations.

## Préconditions avant toute reprise

- FIT-168 : migration releases/médias/V4 et RPC complète, rejouée sur copie.
- FIT-169 : la sauvegarde est restaurable et le reset est limité au périmètre
  beta approuvé.
- FIT-173 : grants, RLS, policies et pgTAP validés.
- FIT-174 : dry-run et rollback réussis sur copie anonymisée.
- B1/B2 : bibliothèque V2 et templates beta approuvés.

Le document historique mentionnait
`20260715125935_repair_user_profile_rpc.sql`, mais ce fichier n'existe pas dans
le dossier actif. Cette référence ne constitue donc pas une migration
applicable.

## Procédure protégée

La CI applicative ne pousse jamais Supabase. Un opérateur autorisé intervient
uniquement après approbation du ticket FIT-182 :

1. identifier le SHA candidat et le project ref attendu ;
2. vérifier une sauvegarde restaurable et sa référence hors dépôt ;
3. appliquer les onze migrations, y compris le snapshot catalogue V2 et la
   diffusion progressive, sur une copie restaurée représentative ;
4. exécuter contrôles de purge, contrats V4, RLS/pgTAP et rollback code/schéma ;
5. relire le plan `--dry-run` ;
6. appliquer les migrations, y compris le snapshot catalogue V2 et la
   diffusion progressive, en fenêtre contrôlée ;
7. vérifier migrations, release/révision `1de8bc8353e79697`, 707 exercices, 455 templates, 1 533
   liens, relations et évaluations historiques remappées avant déploiement
   frontend.

Commandes d'inspection et d'application, depuis `apps/pwa/`. La sortie du
dry-run est conservée hors dépôt avec la référence de sauvegarde et le SHA
candidat :

```bash
supabase migration list --linked
supabase db push --linked --dry-run > /chemin-securise/beta-v1.00-dry-run.txt 2>&1
SUPABASE_PROJECT_REF=vnsisuhlaxxldpwjhgcm \
  pnpm db:production-plan:verify /chemin-securise/beta-v1.00-dry-run.txt pending
supabase db push --linked
supabase migration list --linked
```

Le catalogue V2 est inclus dans
`20260812105130_beta_catalog_v2_seed.sql` : ne pas le rejouer avec
`supabase db query`, `psql`, `--include-seed` ou une exécution manuelle. La
migration est transactionnelle et reste traçable dans l'historique Supabase.

La qualification locale injecte un profil strictement synthétique avec une
évaluation V3 complétée avant le replay. Son audit post-migration prouve les
six remappages, la conservation des scores, de la date et de l'équipement sans
copier de données utilisateur. Cette preuve ne remplace pas l'empreinte agrégée
lecture seule des données réelles, qui doit être identique avant et après.

Interdictions en production :

```text
supabase db reset
supabase migration repair
--include-all
--include-seed
```

La migration beta de catalogue n'est jamais contournée par un seed implicite.
Migration de reset, snapshot catalogue et vérification des volumes sont
effectués dans la même fenêtre contrôlée, avec un point d'arrêt après chaque
commande. Auth, profils et leurs
déclarations d'équipement ou restrictions sont conservés ; programmes, séances,
feedback, préférences de programmation et progressions sont remis à zéro. Les
évaluations déjà complétées sont conservées et leurs codes sont remappés vers la
bibliothèque V2/V4.
