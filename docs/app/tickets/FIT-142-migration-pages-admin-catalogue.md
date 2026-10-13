# FIT-142 - Migration pages admin catalogue

## Statut

`IN_PROGRESS` — implémenté localement, requalification V1 en cours.

## Objectif

Adapter `sessions`, `niveaux`, `formats`, `series`, `repetitions`, `repos` et
`equipements` au socle UI commun issu de `/admin/catalogue/intervalles`.
La page `exercices` reste hors perimetre de cette tranche.

## Criteres d'acceptation

- Les pages ont le meme enchainement global que `/admin/catalogue/intervalles`.
- Les actions principales et secondaires sont placees dans les composants
  communs.
- Les formulaires conservent leurs regles metier.
- La modale format n'expose que ses associations canoniques.
- La modale intervalle n'expose que le libellé et la durée d'effort.
- La modale répétition propose une valeur numérique ou `Maximum`, sans type
  technique persistant.
- La modale session n'expose que titre, description, pilier, famille,
  exercice, niveaux et statut.
- `/admin/catalogue/exercices` n'est pas modifiee par ce ticket.
