# Mise à jour du seed structurel depuis SQLite local

## Objectif

Seuls les référentiels structurels validés (piliers, impacts, familles, types,
groupes musculaires, équipements et formats) peuvent devenir le seed
d'initialisation. Les exercices, leurs médias et les templates proviennent
exclusivement de `docs/bibliotheque` et sont rejetés par ce flux.

## Flux

1. Depuis une page admin catalogue, utiliser `Exporter seed`.
2. L'app produit un snapshot JSON du catalogue SQLite local/dev.
3. Lancer le script :

```bash
pnpm seed:catalog:update-from-snapshot --input ./acrea-fitness-catalog-seed.json
```

4. Verifier sans ecrire :

```bash
pnpm seed:catalog:update-from-snapshot:check --input ./acrea-fitness-catalog-seed.json
```

## Fichiers mis a jour

- `apps/pwa/src/features/catalog/data/catalogSeed.json`
- `apps/pwa/src/shared/db/seeds/catalog-foundation.sqlite.sql`

Le seed structurel Supabase suit sa propre génération avec
`pnpm seed:supabase-v2:generate` ; il n'est pas écrit par ce script.

Le fichier historique `legacy-catalog-seed.sql` reste figé et n'est jamais une
cible des générateurs actifs.

Le snapshot accepté doit contenir des tableaux vides pour `exercises`,
`sessionTemplates` et `sessionTemplateLevels`.

## Contraintes

- Le snapshot ne doit pas contenir `hiit`, `callisthenie` ou `temps`.
- Tout exercice ou template non vide est rejeté afin de préserver la
  bibliothèque bilingue complète comme source opérationnelle unique.
- Les propriétés `intervalKind` et `repetitionKind`, les valeurs
  `maximum_reps`, `controlled_reps`, `hold_position` et les anciens codes
  d'intervalles typés sont rejetés.
- Le snapshot courant contient 11 entrées de répétitions (4 à 12, 16 et une
  seule `Maximum`), 14 durées d'intervalles et 2 219 formats canoniques : 651
  répétitions et 1 568 intervalles.
- Le fichier passe avec `--input` doit provenir d'un export ACREA courant,
  explicitement valide, nomme `acrea-fitness-catalog-seed-YYYY-MM-DD.json`.
- Un ancien fichier temporaire prefixe `rhc-fitness` n'est pas une source
  canonique, meme si son contenu passe le check.
- Le script compare le contenu du snapshot aux seeds ; il ne valide pas
  l'origine du fichier a partir de son nom.
- Le script ne modifie pas la BDD Supabase distante.
- `seed:catalog:generate` gere uniquement les seeds catalogue. Le reset SQL,
  qui compose aussi auth, programmation et equipements, suit les migrations et
  reste controle par `db:docs:check`.
