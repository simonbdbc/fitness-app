# Bibliothèque d’exercices canonique

La source de vérité des exercices publiables est `docs/bibliotheque`. Son
contrat détaillé est défini dans
[`bibliotheque-exercices-v2.md`](./bibliotheque-exercices-v2.md).

Chaque exercice complet possède un slug anglais unique, deux fiches Markdown
(`<slug>-en.md` et `<slug>-fr.md`) et deux médias WebP
(`<slug>-poster.webp` et `<slug>-animate.webp`). Son chemin porte les slugs
canoniques du pilier et de l’équipement :

```text
docs/bibliotheque/<pillarSlug>/<equipmentSlug>/<exerciseSlug>/
```

Les seuls piliers persistés sont `warm-up`, `cardio`, `strength`,
`proprioception` et `flexibility`. Les seuls équipements publiables sont les 25
slugs du référentiel métier. Les libellés français et anglais restent des
contenus éditoriaux ; ils ne servent jamais d’identifiants.

`docs/bibliotheque-incomplete` est une file de correction indépendante. Un
exercice incomplet n'entre ni dans l'artefact PWA, ni dans la seed Supabase, ni
dans la programmation. `unclassified-equipment` est un état de tri réservé à
cette file et n'est pas un équipement métier.

La release courante est `exercise-library-v2`. Elle est générée exclusivement
depuis les fiches complètes :

```sh
pnpm library:generate
pnpm library:check
```

L’interface d’administration est en lecture seule pour les exercices. Toute
modification passe par les Markdown et les médias, puis par la régénération du
catalogue. Le rapport `docs/audits/bibliotheque-v2-audit.json` constitue
l’inventaire reproductible des fiches complètes et incomplètes.
