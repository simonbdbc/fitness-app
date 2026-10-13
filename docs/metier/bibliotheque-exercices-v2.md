# Bibliothèque d’exercices 2.0

La bibliothèque 2.0 réunit les contenus français et anglais sous une identité
d’exercice unique. Les slugs anglais sont les seuls identifiants de dossiers et
de données.

## Arborescence

Une fiche complète se trouve sous :

```text
docs/bibliotheque/<pillarSlug>/<equipmentSlug>/<exerciseSlug>/
├── <exerciseSlug>-en.md
├── <exerciseSlug>-fr.md
├── <exerciseSlug>-poster.webp
└── <exerciseSlug>-animate.webp
```

Une fiche qui ne respecte pas ce contrat se trouve sous la même architecture
dans `docs/bibliotheque-incomplete`. Elle porte `libraryStatus: incomplete` et
une liste `incompleteReasons`. `unclassified-equipment` est uniquement un état
de tri de cette bibliothèque incomplète ; il ne fait pas partie du référentiel
des équipements.

## Piliers

| Slug | Libellé français | Règle métier |
|---|---|---|
| `warm-up` | Échauffement | Activation libre et de faible intensité avant l’effort. |
| `cardio` | Cardio | Effort principalement cardio-respiratoire. |
| `strength` | Renforcement | Force, résistance ou endurance musculaire. |
| `proprioception` | Proprioception | Équilibre, gainage, stabilité, contrôle corporel ou calisthénie technique. |
| `flexibility` | Assouplissement | Étirement, mobilité ou travail d’amplitude. |

Chaque fiche porte `pillarSlug`, `equipmentSlug`, `classificationRule` et
`classificationReviewStatus`. Le chemin doit correspondre exactement aux deux
slugs de classification. L'audit refuse toute fiche dont la classification n'a
pas le statut `valide` et vérifie, lorsqu'elle est présente, que la section
anglaise `Équipement requis vérifié` justifie l'équipement du chemin.

## Complétude

Un exercice rejoint `docs/bibliotheque` uniquement lorsqu’il possède les deux
Markdown, le poster, l’animation, une traduction française sans marqueur
d’attente et un équipement appartenant au référentiel des 25 équipements.

Les raisons normalisées sont :

- `missing-en` ou `missing-fr` ;
- `missing-poster` ou `missing-animation` ;
- `fr-translation-incomplete` lorsqu'un contenu français manque encore ;
- `fr-translation-review-pending` lorsqu'une traduction brouillon existe mais
  attend sa relecture éditoriale ;
- `equipment-unclassified` ;
- `catalog-metadata-incomplete`.

Le rapport `docs/audits/bibliotheque-v2-audit.json` donne les compteurs et la
liste des exercices incomplets. Il est généré avec la bibliothèque et ne doit
pas être modifié manuellement.

## Traductions brouillon

Toutes les fiches possèdent désormais un document français. Les traductions
qui attendent une relecture restent dans `bibliotheque-incomplete` avec
`fr-translation-review-pending`, même si leurs médias sont présents. Elles ne
sont jamais promues automatiquement.

Les 555 libellés d'exercice ont fait l'objet d'une correction terminologique
déterministe et sont conservés dans le glossaire source-exact de traduction.

La relecture du corps est suivie segment par segment. Les 555 descriptions sont
désormais corrigées et verrouillées sur leur source anglaise : 17 pour
`warm-up`, 68 pour `cardio`, 35 pour `proprioception`, 228 pour `strength` et
207 pour `flexibility`. Les consignes, bénéfices, muscles et variantes ont été
retraités puis contrôlés par alignement EN/FR. Le contrôle refuse notamment les
segments anormalement raccourcis, les consignes à l'infinitif, les fragments
anglais résiduels et les contresens terminologiques recensés. Le statut
`fr-translation-review-pending` reste toutefois conservé jusqu'à une validation
éditoriale humaine ; aucun de ces brouillons n'est publié automatiquement.

Le générateur de brouillons est un outil éditorial local :

```sh
python3 scripts/translate-exercise-library-v2.py
python3 scripts/translate-exercise-library-v2.py --labels-only
python3 scripts/translate-exercise-library-v2.py --post-edit-only
ACREA_OPUS_MODEL_DIR=/chemin/vers/opus-mt-en-fr \
  python3 scripts/translate-exercise-library-v2.py --opus-all
```

Il requiert le paquet Argos Translate anglais-français. Les corrections
terminologiques déterministes sont conservées dans
`docs/metier/exercise-translation-overrides`; le script reconstruit les sections
FR et conserve systématiquement le statut de relecture.
L'option `--labels-only` réapplique uniquement les libellés validés sans
relancer ni modifier la traduction du corps des fiches.
L'option `--post-edit-only` réapplique les corrections source-exactes et les
règles terminologiques aux segments déjà alignés, sans appeler le moteur de
traduction.
L'option `--opus-all` retraduit localement les segments non verrouillés avec un
modèle OPUS anglais-français. Elle n'effectue aucun appel réseau et exige le
chemin local du modèle dans `ACREA_OPUS_MODEL_DIR`.

## Commandes

```sh
pnpm library:v2:generate
pnpm library:v2:check
```

La PWA doit lire uniquement `docs/bibliotheque`. Aucun build ni seed ne doit
publier le contenu de `docs/bibliotheque-incomplete`.
