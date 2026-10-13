# Contrat de sortie ACREA Fitness beta v1.00

Release Git : `release-beta-v1.00`. Version applicative cible : `1.0.0-beta.1`.

État au 13 août 2026 : **NO-GO de réouverture**. Le déploiement Pages du SHA
`1fa6843d539ba78cade7b4235b274dd7ddcf3170` appelle la RPC progressive
`public.get_active_catalog_details(text[])`, absente du cache de schéma
Supabase de production. La consultation d'une fiche ne peut donc plus
hydrater son poster WebP. Le plan de retour au GO est consigné dans
[`GO-RECOVERY-PROGRESSIVE-CATALOG.md`](./GO-RECOVERY-PROGRESSIVE-CATALOG.md).

L'ancienne qualification sur
`37568193d36cc5e775720aa783fccb56e818743c` reste une preuve historique ; elle
ne couvre pas ce contrat progressif supplémentaire.

Le 13 août, le replay complet sur une base Supabase locale isolée a validé la
migration corrigée, l'accès `authenticated`, le refus `anon`, le lot maximal
de 25 fiches et les deux WebP de chaque fiche contrôlée. Cette preuve ne vaut
pas pour la production : elle réduit le risque de migration mais ne remplace
ni l'autorisation de l'appliquer, ni le préflight de la cible, ni le smoke
test post-bascule.
La release beta cible directement Supabase production après une migration
explicitement approuvée. Supabase local est l'unique environnement de replay ;
il n'existe pas de beta/copie intermédiaire.

## Frontière de la remise à zéro

Conservés : projet Supabase, configuration, schéma, politiques RLS, fonctions,
identités Auth, profils, déclarations d'équipement et évaluations déjà
complétées. Remis à zéro : catalogue V3, templates, programmes, séances,
feedback, préférences de programmation et progressions. Les évaluations
conservées sont remappées vers les identifiants V2/V4 ; seuls les profils sans
évaluation complétée repassent obligatoirement par l'évaluation V4.

La suppression des comptes Auth n'est pas incluse. Elle nécessite une décision
et une opération séparées.

## Gates obligatoires

| Gate | Preuve attendue | Dernière observation | État |
|---|---|---|---|
| B1 Bibliothèque approuvée | 707 fiches bilingues complètes, 1 414 médias, statut beta traçable | 707 fiches `valide` / `validated` / `eligible`; 555 incomplètes exclues | `PASS` local |
| B2 Templates et candidats | Templates actifs liés à la bibliothèque, phases et niveaux couverts | 455 templates, 1 533 liens ; contrôle statique des trois piliers/niveaux vert | `PASS` local |
| B3 SQLite | Installation fraîche, upgrade V29, second passage et réparation d’un cache V32 hérité | 25 tests runtime verts ; la migration conserve profils et évaluations, répare les références catalogue et le snapshot de programme hérité | `PASS` local |
| B4 Migration Supabase production | Migration additive, releases, médias, V4 RPC, grants et RLS qualifiés localement avant application manuelle en production | Replay isolé, RLS/RPC, conservation et pgTAP V4 `47/47` validés | `PASS` local |
| B5 Parité Supabase/SQLite | Révision, 707 exercices, 455 templates, 1 533 liens sur Supabase et SQLite | Supabase local : révision `1de8bc8353e79697`, `707/455/1 533` | `PASS` local |
| B6 Qualité du candidat | Typecheck, composants, IA/WASM, contrats et build frais liés au SHA | SHA `37568193`; runtime `25/25`, composants `61/61`, bibliothèque `707`; build Pages de production réussi | `PASS` |
| B7 Parcours métier | Profil → V4 → génération → séance → feedback, web et mobile | E2E local `10/10`, incluant profil faible impact sans matériel jusqu'au feedback | `PASS` local |
| B8 Bascule contrôlée | Dry-run, approbation, migrations et contrôles | Dispense de sauvegarde autorisée ; suffixe `20260812130351`--`20260812145000` appliqué et contrôlé en production | `PASS` production |
| B9 Production beta | Auth, PWA, offline, mise à jour et observabilité vérifiés | Le 13 août, Pages sert `1fa6843d`; après mise à jour du service worker, l'ouverture de « Marche talon-pointe » échoue avec `Could not find the function public.get_active_catalog_details(p_slugs) in the schema cache` | `FAIL` production |
| B10 Release | Version beta, notes, matrice de preuves et tag | Tag distant `release-beta-v1.00^{}` = `37568193d36cc5e775720aa783fccb56e818743c` | `PASS` |

## Politique de décision

- Un `FAIL` ou un `UNKNOWN` sur B1–B10 interdit le déploiement de la release.
- Une preuve est datée, reproductible et liée au SHA candidat.
- Le rollback beta restaure le code et le schéma. Il ne restaure pas les données
  métier supprimées : une sauvegarde préalable est requise sauf dispense
  explicite de l'opérateur, documentée dans le dossier de release.
- Aucun `supabase db push` ou seed distant n'est lancé depuis ce chantier sans
  approbation explicite de l'opérateur.

## Objectif de rétablissement

Atteindre de nouveau le GO exige de prouver, pour un même SHA candidat, que
les deux RPC progressives sont présentes, accessibles uniquement au rôle
`authenticated`, cohérentes avec la release active, puis que l'ouverture d'une
fiche télécharge, valide et réaffiche son WebP hors ligne. Aucun nouveau
déploiement Pages ne doit précéder ce contrôle.
