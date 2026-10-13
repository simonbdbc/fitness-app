# EPIC-029 - Performance Web PWA

## Statut

`TODO` — baseline du 16 juillet à remesurer sur le commit candidat. FIT-177
retient pour V1 les seuls gates sécurité, routage et non-régression PWA ; les
optimisations restantes peuvent être reportées via FIT-178.

## Pilotage

- Priorité : moyenne.
- Responsable : Dev secondaire.
- Dépendance au chemin critique catalogue : aucune.

## Baseline

Audit mobile Lighthouse relevé le 16 juillet 2026 sur
`https://acrea-fitness-app.sbcenter.fr/home` :

- Performance : 62.
- Accessibilité : 100.
- Bonnes pratiques : 96.
- SEO : 92.
- FCP : 1,3 s.
- LCP : 7,1 s.
- TBT : 300 ms.
- CLS : 0,128.
- Speed Index : 4,6 s.

L'audit signale également une redirection de `/home` vers `/`, un bundle
JavaScript initial trop important, des erreurs console, une CSP encore
Report-Only et un `robots.txt` invalide servi sous forme de HTML.

## Objectif

Améliorer le chargement initial et la stabilité visuelle de la PWA, fiabiliser
la mesure des routes publiques et authentifiées, puis corriger les écarts SEO
et de bonnes pratiques sans modifier les fonctionnalités métier.

## Périmètre

- Mesure reproductible de `/`, `/login`, `/offline` et `/home` authentifié.
- Routage Cloudflare et applicatif sans redirection inattendue.
- Réduction du JavaScript initial et du travail sur le thread principal.
- Chargement différé de SQLite, des providers métier, de l'administration et
  du moteur IA lorsque la route ne les utilise pas.
- Correction du `robots.txt`, de la politique d'indexation et des headers de
  sécurité.
- Validation Lighthouse locale et post-déploiement documentée.

## Hors Périmètre

- Ajout de Lighthouse au pipeline GitLab.
- Modification fonctionnelle métier ou migration de données.
- Indexation des routes protégées.
- Publication de source maps en production.
- Catégorie Lighthouse Agentic Browsing.

## Critères De Sortie

- Trois audits mobiles sont exécutés par route et la médiane est conservée.
- Performance supérieure ou égale à 95.
- Accessibilité et Bonnes pratiques à 100.
- SEO à 100 sur `/` et `/login` uniquement.
- FCP inférieur ou égal à 1,8 s.
- LCP inférieur ou égal à 2,5 s.
- TBT inférieur ou égal à 200 ms.
- CLS inférieur ou égal à 0,1.
- La conformité PWA, le mode offline et la mise à jour restent validés.

## Tickets

- `FIT-152` - Mesure fiable et routage des entrées PWA.
- `FIT-153` - Réduction du bundle et optimisation du rendu initial.
- `FIT-154` - SEO public et headers de sécurité.
- `FIT-155` - Validation finale et non-régression PWA.
