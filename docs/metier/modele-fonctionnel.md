ACREA Fitness — Modèle fonctionnel

1. Hiérarchie métier retenue

La structure métier retenue est la suivante :

Programme
└── Entraînements
└── Séances
└── Sessions + Niveau
├── Exercice
└── Format
└── Séries
├── Répétitions / Intervalles
└── Repos

Structure simplifiée :

Programme → Entraînements → Séances → Sessions + Niveau → Exercice + Format → Séries → Répétitions / Intervalles + Repos

Cette hiérarchie permet de distinguer :

- la planification hebdomadaire ;
- l’entraînement du jour ;
- les séances par pilier ;
- les sessions adaptées au niveau utilisateur ;
- les exercices du catalogue ;
- les formats d’exécution ;
- les séries, répétitions, intervalles et temps de repos.

⸻

2. Catégories d’exercices

Les exercices sont catégorisés à l’aide de tags métier.

Ces tags permettent :

- de filtrer le catalogue ;
- de générer les programmes hebdomadaires ;
- d’adapter les séances au profil utilisateur ;
- de répartir les efforts ;
- d’éviter les redondances ;
- de gérer les contraintes d’impact, de matériel ou de groupe musculaire.

⸻

Famille

La famille correspond à la zone corporelle ou au type global de sollicitation.

Valeurs retenues :

corps-entier
haut-du-corps
bas-du-corps

Définitions

Famille Définition
corps-entier Exercice sollicitant fortement plusieurs zones du corps.
haut-du-corps Exercice ciblant principalement le haut du corps.
bas-du-corps Exercice ciblant principalement le bas du corps.

Exemples :

Pompes → haut-du-corps
Squats → bas-du-corps
Burpees → corps-entier
Mountain climbers → corps-entier

⸻

Type

Le type correspond à la nature principale de l’effort ou de l’objectif travaillé.

Valeurs retenues :

echauffement
cardio
gainage
force
endurance
proprioception
assouplissement

Définitions

Type Définition
echauffement Exercice orienté préparation progressive à l’effort.
cardio Exercice orienté intensité cardio-respiratoire.
gainage Exercice orienté stabilité du tronc, maintien postural ou contrôle du centre du corps.
force Exercice orienté force musculaire ou résistance mécanique.
endurance Exercice orienté capacité à maintenir l’effort dans le temps.
proprioception Exercice orienté stabilité, proprioception ou contrôle corporel.
assouplissement Exercice orienté mobilité, amplitude articulaire ou étirement contrôlé.

⸻

Groupe musculaire

Le groupe musculaire correspond aux muscles ou zones principalement sollicités.

Valeurs retenues :

bras
epaules
dos
jambes
fessiers
abdos
pecs

Un exercice peut cibler plusieurs groupes musculaires.

Exemples :

Pompes → pecs, epaules, bras, abdos
Squats → jambes, fessiers, abdos
Gainage → abdos, epaules
Mountain climbers → abdos, jambes, epaules

⸻

3. Classification des exercices

Chaque exercice doit être classé selon plusieurs dimensions métier.

Classification principale

Chaque exercice possède :

Pilier
Difficulté
Impact
Famille
Type
Groupes musculaires
Équipement
État de publication
État de révision

⸻

Pilier

Le pilier définit le grand objectif de l’exercice dans ACREA Fitness.

Valeurs retenues :

| code | label |
| --- | --- |
| echauffement | Activation |
| cardio | Cardio |
| renforcement | Renforcement |
| proprioception | Équilibre |
| assouplissement | Assouplissement |

Renforcement

Le pilier renforcement regroupe les exercices orientés force, musculation au poids du corps, endurance musculaire et contrôle musculaire.

La difficulté est principalement liée à :

- la force ;
- l’endurance musculaire ;
- le volume de répétitions ;
- la charge relative du poids du corps ;
- l’amplitude ;
- la difficulté mécanique.

Exemples :

Pompes
Squats
Fentes
Dips
Tractions
Gainage dynamique

⸻

Cardio

Le pilier cardio regroupe les exercices orientés HIIT, intensité, endurance cardio-respiratoire et dépense énergétique.

La difficulté est principalement liée à :

- l’intensité ;
- la fréquence cardiaque ;
- la durée des intervalles ;
- la densité effort/repos ;
- l’endurance cardio ;
- l’impact articulaire potentiel.

Exemples :

Jumping jacks
Burpees
Mountain climbers
High knees
Squat jumps
Skaters

⸻

Proprioception

Le pilier proprioception regroupe les exercices orientés équilibre, stabilité, coordination, calisthénie technique, contrôle corporel et qualité du mouvement.

La difficulté est principalement liée à :

- la technique ;
- l’équilibre ;
- la stabilité ;
- la coordination ;
- le contrôle moteur ;
- la précision d’exécution.

Exemples :

Équilibre sur une jambe
Bird dog
Planche latérale
Hollow hold
Dead bug
Squat contrôlé
Progressions calisthénie

⸻

Difficulté

La difficulté correspond à un range de niveaux de 1 à 10.

Niveau 1 = très facile
Niveau 10 = très difficile

La difficulté est évaluée différemment selon le pilier.

Difficulté en renforcement

Pour le renforcement, la difficulté est principalement liée à :

force + endurance musculaire

Critères possibles :

- force nécessaire ;
- nombre de répétitions possibles ;
- endurance musculaire ;
- amplitude ;
- levier mécanique ;
- temps sous tension ;
- contrôle technique.

⸻

Difficulté en cardio

Pour le cardio, la difficulté est principalement liée à :

intensité + endurance cardio

Critères possibles :

- intensité de l’exercice ;
- durée de l’effort ;
- fréquence des répétitions ;
- temps de repos ;
- impact cardio-respiratoire ;
- capacité à maintenir le rythme.

⸻

Difficulté en proprioception

Pour la proprioception, la difficulté est principalement liée à :

technique + équilibre

Critères possibles :

- stabilité nécessaire ;
- coordination ;
- précision du mouvement ;
- maintien postural ;
- contrôle moteur ;
- asymétrie ;
- réduction des appuis ;
- complexité technique.

⸻

Impact

L’impact correspond au niveau de contrainte mécanique, articulaire ou cardio-articulaire de l’exercice.

Valeurs retenues :

faible
modéré
élevé

Impact faible

Exercice avec peu ou pas de sauts, peu de chocs et une contrainte articulaire réduite.

Exemples :

Gainage
Squat contrôlé
Bird dog
Dead bug
Équilibre sur une jambe

Impact modéré

Exercice avec une sollicitation plus importante, mais contrôlable.

Exemples :

Pompes
Fentes
Mountain climbers contrôlés
Squats dynamiques

Impact élevé

Exercice avec sauts, chocs, grande intensité ou forte contrainte articulaire.

Exemples :

Burpees
Squat jumps
Jumping lunges
High knees rapides
Jumping jacks rapides

⸻

Équipement

Chaque exercice peut nécessiter un équipement ou aucun équipement.

Exemples :

aucun
chaise
barre
élastique
tapis
mur
banc

Un exercice sans équipement doit être compatible avec la valeur :

aucun

⸻

État de publication

L’état de publication permet de contrôler la disponibilité d’un exercice dans l’application.

Valeurs possibles recommandées :

brouillon
publié
archivé

Définitions

État Définition
brouillon Exercice en préparation, non visible par l’utilisateur.
publié Exercice validé et disponible dans l’application.
archivé Exercice retiré du catalogue actif, conservé pour historique.

⸻

État de révision

L’état de révision permet de suivre la qualité éditoriale et technique d’un exercice.

Valeurs possibles recommandées :

à_réviser
en_révision
validé

Définitions

État Définition
à_réviser Exercice à contrôler ou à corriger.
en_révision Exercice en cours de vérification.
validé Exercice validé côté contenu, consignes et classification.

⸻

4. Évaluation de niveau et niveaux utilisateur

La V3 décrite ci-dessous est le protocole historique encore présent en
production. La cible unique de la release 1.0.0 est V4, définie par
`contracts/catalog/acrea-level-evaluation-v4.json` et suivie par EPIC-028,
FIT-168, FIT-172 et FIT-176. Tant que la migration, la RPC et les six mappings
V4 ne sont pas qualifiés de bout en bout, le programme hebdomadaire V1 reste
bloqué. Le protocole est reprenable et organisé en trois séances
successives avec les six mêmes exercices, deux par pilier :

1. séance 1 avec la première prescription propre à chaque exercice ;
2. séance 2 avec la seconde prescription propre à chaque exercice ;
3. séance 3 en une série maximale stricte par exercice.

| Exercice | Code catalogue | Séance 1 | Séance 2 | Niveau 1 | Niveau 2 | Niveau 3 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Pompes strictes | `renforcement-pompe-stricte` | `2x8` | `3x8` | `0-19` | `20-49` | `50+` |
| Squats poids du corps | `renforcement-squat-poids-du-corps` | `2x12` | `3x12` | `0-29` | `30-79` | `80+` |
| Burpee sans pompe | `cardio-burpee-sans-pompe` | `2x8` | `3x8` | `0-19` | `20-49` | `50+` |
| Mountain climber | `cardio-mountain-climber-classique` | `2x16` | `3x16` | `0-39` | `40-89` | `90+` |
| Relevé de jambes au sol | `proprioception-releve-de-jambes-au-sol` | `2x8` | `3x8` | `0-19` | `20-49` | `50+` |
| Planche lean dynamique | `proprioception-planche-lean` | `2x6` | `3x6` | `0-9` | `10-29` | `30+` |

Une répétition de planche lean comprend l'aller des épaules au-delà des mains,
bras tendus et corps gainé, puis le retour contrôlé à la position de départ.

Chaque séance comprend une proposition libre d'échauffement de cinq minutes,
les six exercices dans un ordre fixe, une carte manuelle « Récupération libre
2 à 3 min » entre les exercices, puis une proposition libre
d'assouplissements de cinq minutes. Les blocs globaux peuvent être terminés
avant la fin du minuteur. Après chaque exercice, l'utilisateur renseigne la
validation technique et une appréciation de 1 à 5. La séance 3 exige aussi le
maximum de répétitions. Un seul échec technique invalide la séance entière,
mais les six exercices sont terminés et la tentative reste archivée avant de
rejouer la séance depuis le début.

Le niveau du pilier est le plus faible de ses deux exercices. Les trois niveaux
du profil ne sont mis à jour qu'après trois séances entièrement validées. Une
nouvelle évaluation volontaire ne bloque pas le programme existant ; ses
résultats ne prennent effet qu'après sa finalisation complète. La gestion de la
douleur pendant l'évaluation reste une évolution ultérieure ; aucun champ de
douleur, progression ou notes libres n'est demandé dans ce parcours.

⸻

5. Programme hebdomadaire — comportement historique V3, cible V4

Les règles ci-dessous décrivent le comportement V3 de production. Elles ne
constituent plus le contrat de sortie V1 tant que leur équivalent V4 n'est pas
validé. Chaque journée reprend une composition principale stable comprenant :

1. une proposition libre de 5 minutes d'échauffement ;
2. un bloc principal Renforcement ;
3. un bloc principal Cardio ;
4. un bloc principal Proprioception ;
5. une proposition libre de 5 minutes d'assouplissements.

La séance complète doit atteindre `sessionMinutesMin` sans dépasser
`sessionMinutesMax`. Les deux bornes vont de 20 à 180 minutes par pas de cinq,
avec au moins cinq minutes d'écart. Seuls les trois blocs principaux sont
scorés par Burn, évalués et adaptés. Les niveaux issus de l'évaluation filtrent
les exercices à `+/-1`. Une récupération de 90 secondes suit chaque exercice
principal. Elle démarre avec l'affichage du feedback, peut être terminée
manuellement et reste comptée intégralement dans la durée maximale.

Pour l'objectif Complet, le temps principal est équilibré entre les piliers.
Pour un objectif spécialisé, la cible est `50/25/25`. Les mêmes exercices sont
conservés sur tous les jours choisis, sauf restriction, douleur, indisponibilité
matérielle ou appréciation égale à 1.

⸻

6. Progression persistante

La prescription exécutable est indépendante du format catalogue, qui reste une
référence d'audit. Elle est persistée par profil et exercice, puis appliquée à
toutes les occurrences futures non réalisées.

Pour les répétitions, les niveaux 1 à 5 parcourent `2x4...2x8`, puis
`3x4...3x8`, jusqu'à `8x8`, avec 30 secondes de repos. Les niveaux 6 à 10
parcourent `6x8...6x12`, puis `7x8...7x12`, jusqu'à `12x12`, avec le même
repos. « Plus difficile » avance d'un palier, « Identique » conserve la
prescription et « Plus facile » recule d'un palier.

Les intervalles suivent quatre échelles : Cardio niveaux 1 à 5 (`2-5` séries,
effort `30-60 s`, repos `60-30 s`), Cardio niveaux 6 à 10 (`4-8` séries,
effort `20-60 s`, repos `60-20 s`), Proprioception niveaux 1 à 5 (`1-4`
séries, effort `30-180 s`, repos `60/30 s`) et Proprioception niveaux 6 à 10
(`1-8` séries, effort `30-300 s`, repos `60/30 s`). La progression augmente
d'abord l'effort, diminue ensuite le repos, puis ajoute une série en revenant
au minimum d'effort et au repos maximal du palier. La régression suit l'ordre
inverse. Douleur, arrêt ou qualité inférieure ou égale à 2 imposent une
régression de sécurité. Une progression qui dépasserait la durée maximale est
différée.

L'échauffement et les assouplissements ne sont jamais adaptés.

⸻

7. Appréciation et renouvellement

La moyenne des trois appréciations d'évaluation initialise l'historique du
premier programme. Une appréciation d'évaluation égale à 1 dépriorise
l'exercice sans l'exclure. Dès qu'un feedback d'entraînement existe pour cet
exercice, il devient la source prioritaire.

Chaque exercice principal exige ensuite une appréciation de 1 à 5, distincte de
l'effort, de la qualité technique et du souhait de progression. Une note de 1
exclut immédiatement l'exercice pour ce profil et remplace ses occurrences
futures par un candidat sûr du même pilier. L'utilisateur peut restaurer
l'exercice depuis son profil.

À la génération d'une nouvelle semaine, `weeklyNoveltyPercent` réserve de 0 à
100 % des emplacements à la nouveauté, par pas de 10. La continuité privilégie
les exercices les mieux appréciés par pilier. La nouveauté privilégie les
exercices jamais appréciés, puis les moins récemment pratiqués.

⸻

8. Template et session exécutable

Le template catalogue contient un exercice, une phase (`warmup`, `main` ou
`cooldown`), des niveaux autorisés et un statut. Le format compatible reste une
référence d'audit. La session générée ajoute une prescription exécutable :
séries, répétitions ou intervalles, repos, durée estimée et caractère adaptable.

Structure finale :

Programme → Entraînements → Phases → Sessions → Exercice + Format d'audit +
Prescription exécutable. Le catalogue actif contient exactement 2 219 formats
canoniques : 651 formats de répétitions et 1 568 formats d'intervalles. Chaque
prescription doit être résolue vers son `formatId`, son `formatCode` et son
libellé exact avant persistance ; les anciens formats restent historiques et
ne sont plus sélectionnables.
