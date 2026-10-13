# Parité des environnements de données

État vérifié le 12 août 2026 : **parité non atteinte**.

## Matrice courante

| Objet | SQLite/WIP | Supabase local cible | Supabase production |
|---|---|---|---|
| Protocole | sélection V4, SQLite V32 migrable | V4 incomplet | V3 |
| Exercices | artefact V2 : 707 complets, 555 exclus | seed V2 configuré, migrations préalables incomplètes | 236 |
| Médias | 1 414 dans l'artefact | table migration WIP | table absente |
| Équipements | 25 | cible 25 | 24 |
| Formats | 2 219 | seed historique incompatible | 2 554 |
| Templates | 0 | 0 après migration V2 | 236 |
| Release catalogue | `exercise-library-v2`, revision `9a3155551f23266b` | table fondatrice absente | table absente |
| Programme/feedback | runtime local, V32 additive en smoke test | migration V2 distante destructive | V3, volumes nuls observés |
| Finalisation évaluation | appel client V4 | RPC V4 absente | RPC V3 |

## Parité exigée pour V1

La parité ne signifie pas que SQLite et PostgreSQL ont le même moteur. Elle
impose le même contrat métier observable :

- release, revision et hash de la bibliothèque V2 ;
- volumes et identifiants canoniques ;
- relations exercices/muscles/équipements/médias/templates ;
- mappings et protocole V4 ;
- règles d'autorisation et de synchronisation ;
- conservation des programmes, évaluations et feedback existants.

## Preuves attendues

- test SQLite réel base vide → cible ;
- test SQLite réel V29 → cible avec données sentinelles conservées ;
- reset Supabase local complet avec seed V2 configuré ;
- pgTAP et parcours basic/premium/admin ;
- dry-run sur copie anonymisée de production ;
- rapport automatisé comparant revision, volumes et relations.

`db:runtime:test` exécute désormais SQLite réellement, mais reste rouge tant
que le contrat V4 ne trouve pas sa migration fondatrice. `db:docs:check` reste
un contrôle du contrat V3/documentaire et ne prouve ni replay V4 ni parité.
Leur complément par snapshot complet, reset Supabase et diff automatisé reste
suivi dans FIT-169/FIT-170.
