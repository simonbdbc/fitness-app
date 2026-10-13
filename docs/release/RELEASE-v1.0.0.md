# Contrat de sortie ACREA Fitness 1.0.0

Release Git : `release-v1.00`. Version applicative : `1.0.0`.

État au 12 août 2026 : `NO-GO`.

## Gates obligatoires

| Gate | Preuve attendue | Dernière observation | État |
|---|---|---|---|
| G1 Référentiel V2 | 707 fiches bilingues complètes, revue métier et licence tracées ; incomplets exclus | V2 génère 707 exercices/1 414 médias, 555 incomplets exclus ; revue et licence ouvertes | `FAIL` |
| G2 Programmation | Templates approuvés et candidats non vides pour les 3 piliers | Couverture Strength/Cardio/Proprioception disponible, mais 0 template et 707 `library_only` | `FAIL` |
| G3 SQLite fresh install | Test réel d'une base vide jusqu'à la version cible | Smoke 0→32 réel vert, mais pas encore lié à un SHA candidat | `FAIL` |
| G4 SQLite upgrade | Test réel v29→cible avec conservation des données utilisateur | Vrai DDL V29 + graphe 14 tables verts ad hoc ; fixture CI complète et rollback manquent | `FAIL` |
| G5 Supabase replay | Reset complet, seed V2, V4, grants/RLS/pgTAP | Migration fondatrice/RPC V4 absentes ; migration V2 destructive | `FAIL` |
| G6 Parité | Même release/revision/volumes entre artefact, SQLite et Supabase | WIP `exercise-library-v2` : 707/0 templates ; prod V3 : 236/236 | `FAIL` |
| G7 Qualité code | Typecheck, composants, IA, Rust, architecture et contrats verts | Typecheck, composants 58/58, IA 30/30 verts ; gate DB/V4 rouge | `FAIL` |
| G8 Build candidat | Build frais rattaché au SHA candidat, PWA validée | `dist` correspond encore au SHA de production | `FAIL` |
| G9 E2E métier | Auth → évaluation → programme → séance → feedback, web et mobile | Impossible sans candidats programmables | `FAIL` |
| G10 Données/rollback | Sauvegarde, dry-run, contrôles post-migration, rollback testé | Aucun dry-run/rollback Supabase complet | `FAIL` |
| G11 Production | URLs, Auth, offline, update, CSP/robots et observabilité vérifiés | Smoke public partiel seulement | `FAIL` |
| G12 Release | versions 1.0.0, notes, matrice de preuves et tag signé | Versions encore 0.1.0, aucun tag candidat | `FAIL` |

## Politique de décision

- Un seul `FAIL` ou `UNKNOWN` entraîne `NO-GO`.
- Une preuve doit être datée, reproductible et liée au SHA candidat.
- Les tests qui n'exécutent pas le moteur réel qu'ils prétendent couvrir ne
  satisfont pas le gate.
- Les versions ne sont modifiées qu'après passage de G1 à G11.

## Rollback de référence

Tant que la V1 n'est pas publiée, la référence déployée est
`369cc098128faf47f529e7f383707639f88868ae`. Toute migration de données exige
un rollback indépendant du rollback frontend.
