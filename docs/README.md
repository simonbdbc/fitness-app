# Documentation ACREA Fitness

État de référence : 22 août 2026.

## Ordre de préséance

1. Référentiels métier approuvés sous `docs/metier/` et fiches qualifiées sous
   `docs/bibliotheque/`.
2. Contrats versionnés sous `contracts/`.
3. Migrations et seeds exécutables sous `apps/pwa/supabase/` et
   `apps/pwa/src/shared/db/`.
4. Code applicatif et tests.
5. Schémas SQL documentaires générés sous `docs/sql/`.
6. Audits datés, qui décrivent un état historique et ne sont jamais normatifs.

La chaîne catalogue cible est unidirectionnelle :

```text
bibliothèque bilingue complète
→ artefact généré et hashé
→ migration/seed Supabase
→ release distante active
→ cache SQLite/PWA
```

`docs/bibliotheque-incomplete/` regroupe les exercices qui n'ont pas encore
leurs deux fiches linguistiques, leurs deux médias ou une classification
d'équipement canonique. Elle est auditée, mais n'est lue par aucun build, seed
ou test de publication PWA.

## Pilotage actif

- [ROADMAP.md](./ROADMAP.md) : état unique des jalons, dépendances et gates.
- [architecture/MAIL-PRODUCTION.md](./architecture/MAIL-PRODUCTION.md) :
  architecture, exploitation et vérifications de la messagerie de production.
- [release/RELEASE-BETA-v1.00.md](./release/RELEASE-BETA-v1.00.md) : contrat de
  sortie beta actif.
- `audits/AUDIT-RELEASE-V1-2026-08-11.md` (preuve interne conservée dans GitLab, exclue du dépôt de présentation) : preuves du dernier audit complet.
- `audits/BETA-V1.00-VALIDATION-2026-08-12.md` (preuve interne conservée dans GitLab, exclue du dépôt de présentation) :
  décision et contrôles de la bibliothèque beta.
- `app/epics/EPIC-025` à `EPIC-034` : lots actifs.
- `app/tickets/FIT-138` à `FIT-185` : unités de livraison actives.

## Statuts autorisés

- `DONE` : critères satisfaits avec preuve reproductible.
- `IN_PROGRESS` : travail présent, critères non encore tous satisfaits.
- `TODO` : travail non commencé ou non prouvé.
- `BLOCKED` : impossible à livrer tant qu'une dépendance identifiée reste
  ouverte.

Ni un fichier présent, ni un test isolé, ni un pourcentage estimé ne valent
preuve de livraison. La preuve attendue est indiquée dans chaque ticket ou gate.

## Périmètre du dépôt de présentation

Seules les six fiches d’évaluation V4 sont incluses dans `bibliotheque/`. Les descriptions de la bibliothèque complète et de son fonctionnement concernent la source privée ; les fiches incomplètes, les corpus de traduction et les seeds complets ne sont pas distribués ici.
