# FIT-155 - Validation finale et non-régression PWA

## Statut

`TODO` — non commencé ou non prouvé pour la V1.

## Pilotage

- Priorité : moyenne.
- Responsable : Dev secondaire.
- EPIC : `EPIC-029`.

## Objectif

Valider les objectifs de l'EPIC sur un build de production puis sur le domaine
déployé, sans réintroduire Lighthouse dans le pipeline GitLab.

## Critères D'acceptation

- `validate:pwa` vérifie `robots.txt`, les routes profondes, les headers de
  sécurité et l'absence de fallback HTML pour les assets.
- Les budgets du bundle initial et l'absence des chunks admin, SQLite et WASM
  sur les routes publiques sont vérifiés.
- Trois audits mobiles par route sont exécutés en preview puis en production.
- La médiane atteint Performance 95, Accessibilité 100 et Bonnes pratiques 100.
- SEO atteint 100 sur `/` et `/login`.
- Un résumé de la baseline et des résultats finaux est conservé dans
  `docs/audits/`; les rapports détaillés restent privés.
- Installation, service worker, update, offline et navigation profonde sont
  testés séparément de Lighthouse.
- La catégorie Agentic Browsing est explicitement exclue du bilan.
