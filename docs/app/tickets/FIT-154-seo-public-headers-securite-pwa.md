# FIT-154 - SEO public et headers de sécurité PWA

## Statut

`TODO` — non commencé ou non prouvé pour la V1.

## Pilotage

- Priorité : moyenne.
- Responsable : Dev secondaire.
- EPIC : `EPIC-029`.

## Objectif

Corriger les écarts SEO des entrées publiques et renforcer les protections du
navigateur sans rendre les routes privées indexables.

## Critères D'acceptation

- Un véritable `public/robots.txt` est servi en HTTP 200 avec un type texte.
- `/` et `/login` sont crawlables; les routes protégées sont exclues de
  l'indexation avec `robots.txt` et `X-Robots-Tag`.
- La CSP passe de Report-Only à une politique active validée en preview.
- `unsafe-eval` est absent de la CSP de production et `connect-src` ne contient
  que des origines réellement configurées.
- HSTS, COOP, protection anti-framing, `X-Content-Type-Options`,
  `Referrer-Policy` et `Permissions-Policy` sont servis par Cloudflare Pages.
- Les routes auditées ne produisent aucune erreur console non gérée.
- Lighthouse SEO atteint 100 sur `/` et `/login` et Bonnes pratiques atteint
  100 sur les routes contractuelles.
