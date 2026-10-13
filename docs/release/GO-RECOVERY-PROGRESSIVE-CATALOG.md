# Résultat GO — catalogue progressif hors ligne

Date : 13 août 2026
SHA candidat et publié : `aacc4aa1945656f1398174191e0c5a29c6b039a9`
Environnements qualifiés : Supabase local isolé, Supabase production et Pages
production.

## Décision

**GO.** La bibliothèque ne télécharge plus les médias d'une fiche tant que
celle-ci n'est pas ouverte. Les six exercices d'évaluation restent embarqués ;
les autres médias proviennent exclusivement des chemins Cloudflare Pages
versionnés après hydratation de la fiche.

## État final

| Contrôle | Résultat | Preuve |
|---|---|---|
| Migration Supabase progressive | PASS | `20260813074437_catalog_progressive_delivery.sql` est appliquée en production après autorisation explicite. Les deux RPC sont `SECURITY INVOKER`, refusées à `anon` et exécutables par `authenticated`. |
| Index progressif | PASS | `get_active_catalog_index()` retourne l'index des 707 exercices sans médias ; les détails sont demandés par lots bornés de 25 via `get_active_catalog_details(text[])`. |
| Base SQLite existante | PASS | Les migrations réelles V29/V32/V33 préservent profils, évaluations et historique ; une fiche marquée disponible mais sans WebP est réhydratée. |
| Médias hors bundle | PASS | Le build ne publie que les 12 WebP embarqués des six évaluations ; les 701 autres fiches ne sont pas importées dans le bundle PWA. |
| Cartes de bibliothèque | PASS | Une URL héritée `docs/bibliotheque/...` est volontairement ignorée : aucune image ni requête média n'est rendue avant l'hydratation. |
| Fiche progressive | PASS | En production, l'ouverture de `Back and Forth Step` charge le poster versionné, puis l'animation seulement après l'action explicite. |
| Téléchargement complet | PASS local | Lots de 25, progression, annulation et reprise sont couverts ; les 2 WebP par fiche sont vérifiés dans Cache Storage avec SHA-256. |
| Mise à jour de release | PASS | La détection reste explicite et l'activation est atomique ; le contrôle CI ajouté par erreur a été retiré et la chaîne Pages habituelle est restaurée. |

## Correctif final

Le commit `aacc4aa1` empêche l'affichage sur les cartes des chemins média
hérités d'anciennes bases SQLite. Seuls les chemins
`/library/<révision>/...`, écrits par la réponse de détail, peuvent être
utilisés. Cela évite les requêtes automatiques vers des WebP historiques et
supprime le faux état visuel « Image indisponible » pour une fiche simplement
non téléchargée.

## Vérifications du SHA publié

| Commande | Résultat |
|---|---|
| `pnpm --dir apps/pwa typecheck` | PASS |
| `pnpm --dir apps/pwa component:test` | PASS — 66 tests |
| `pnpm --dir apps/pwa db:runtime:test` | PASS — 37 tests, dont migrations SQLite réelles et contrat RPC progressif |
| `pnpm --dir apps/pwa catalog:boundary:test` | PASS — 11 tests |
| `pnpm --dir apps/pwa pwa:contract:test` | PASS — 16 tests |
| `pnpm --dir apps/pwa ai:pwa:test` | PASS — 30 tests |
| `pnpm --dir apps/pwa catalog:equipment:test` | PASS — 4 tests |
| `pnpm --dir apps/pwa build:web && pnpm --dir apps/pwa validate:pwa` | PASS |
| `pnpm --dir apps/pwa e2e:test` | PASS — 10 parcours, dont minuteur, profil et évaluation V4 hors réseau |

## Smoke production

URL : `https://acrea-fitness-app.sbcenter.fr/bibliotheque`

1. L'écran affiche l'index léger : 707 exercices, 5 piliers et le bouton
   « Télécharger la bibliothèque ».
2. Avant ouverture d'une fiche non hydratée, aucune image de carte ni erreur
   console n'est présente.
3. L'ouverture de `Back and Forth Step` charge le poster
   `/library/1de8bc8353e79697/.../back-and-forth-step-poster.webp`.
4. « Voir l'animation » charge seulement alors
   `/library/1de8bc8353e79697/.../back-and-forth-step-animate.webp`.
5. Aucun overlay applicatif ni message console `error`/`warn` n'a été relevé.

## Garde-fous conservés

- La migration Supabase demeure manuelle et ne peut pas être appliquée par le
  pipeline Pages.
- Le préflight de schéma est une commande manuelle de lecture seule ; aucun
  job CI supplémentaire ni variable GitLab n'est requis.
- Les données métier des profils et les évaluations terminées ne sont jamais
  purgées par la migration progressive.
- Les évaluations V4 et le minuteur restent utilisables immédiatement hors
  ligne avec le noyau embarqué.
