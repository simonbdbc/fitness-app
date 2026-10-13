# FIT-152 - Mesure fiable et routage des entrées PWA

## Statut

`TODO` — non commencé ou non prouvé pour la V1.

## Pilotage

- Priorité : moyenne.
- Responsable : Dev secondaire.
- EPIC : `EPIC-029`.

## Objectif

Obtenir une mesure reproductible des routes publiques et de l'accueil
authentifié sans auditer une redirection ou une page différente de la cible.

## Critères D'acceptation

- Un audit local documenté couvre `/`, `/login`, `/offline` et `/home` avec
  une session locale contrôlée pour cette dernière route.
- Trois exécutions mobiles sont réalisées par route et la médiane est retenue.
- `/` affiche l'entrée publique attendue sans redirection parasite pour un
  visiteur non authentifié.
- `/home` reste sur `/home` avec une session valide et renvoie vers `/login`
  sans session.
- Cloudflare sert le shell applicatif en HTTP 200 pour chaque route profonde
  connue et ne redirige pas `/home` vers `/`.
- Les assets inexistants et `robots.txt` ne reçoivent jamais le shell HTML.
- Lighthouse n'est ajouté à aucun job GitLab.
