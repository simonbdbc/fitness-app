ACREA Fitness — Lexique métier

Lexique des termes métier

Programme

Un Programme correspond au programme hebdomadaire personnalisé de l’utilisateur.

Il est généré ou mis à jour chaque semaine en suivant les recommandations du profil utilisateur.

Il prend notamment en compte :

* le nombre de jours d’entraînement par semaine ;
* le nombre de minutes disponibles par jour ;
* le niveau utilisateur ;
* les contraintes de faible impact ;
* la liste des équipements utilisables ;
* les objectifs de progression ;
* les éventuelles limitations ou préférences utilisateur.

Exemple :

Programme hebdomadaire
Durée : 4 entraînements par semaine
Temps disponible : 25 minutes par jour
Impact : faible
Équipement : aucun
Niveau utilisateur : 1

Le programme sert de cadre hebdomadaire.
Il définit les entraînements prévus sur la semaine.

⸻

Entraînement

Un Entraînement correspond à l’entraînement du jour.

Il représente une journée planifiée dans le programme hebdomadaire.

Exemples :

Entraînement du lundi
Entraînement du jour 1
Entraînement du jour 3

Un programme contient plusieurs entraînements.

Un entraînement peut contenir une ou plusieurs séances selon la structure prévue.

Exemple :

Entraînement du jour
├── Séance Renforcement
├── Séance Cardio
└── Séance Proprioception

⸻

Séance

Une Séance correspond à une partie structurée de l’entraînement du jour.

Elle est associée à un pilier principal.

Dans ACREA Fitness, les séances principales sont :

Séance Renforcement
Séance Cardio
Séance Proprioception

Séance Renforcement

Une Séance Renforcement correspond à une séance orientée musculation, force, endurance musculaire et contrôle du mouvement.

Elle repose principalement sur des exercices au poids du corps ou avec équipement léger.

La difficulté est principalement liée à :

* la force nécessaire ;
* l’endurance musculaire ;
* le volume de répétitions ;
* le temps sous tension ;
* la complexité mécanique du mouvement.

Exemple :

Séance Renforcement
├── Session de pompes niveau 2
├── Session de squats niveau 2
└── Session de gainage niveau 2

⸻

Séance Cardio

Une Séance Cardio correspond à une séance orientée HIIT, intensité, endurance cardio-respiratoire et dépense énergétique.

Elle repose principalement sur des efforts chronométrés, des intervalles et des récupérations courtes ou contrôlées.

La difficulté est principalement liée à :

* l’intensité de l’effort ;
* la durée des intervalles ;
* la densité effort/repos ;
* la sollicitation cardio-respiratoire ;
* la capacité à maintenir le rythme.

Exemple :

Séance Cardio
├── Session de jumping jack niveau 3
├── Session de mountain climbers niveau 3
└── Session de burpees niveau 3

⸻

Séance Proprioception

Une Séance Proprioception correspond à une séance orientée calisthénie, contrôle corporel, équilibre, stabilité, coordination, mobilité active et maîtrise technique.

Elle peut inclure :

* des postures maintenues ;
* des mouvements contrôlés ;
* des exercices d’équilibre ;
* des exercices asymétriques ;
* des exercices de gainage technique ;
* des progressions de calisthénie.

La difficulté est principalement liée à :

* la technique ;
* l’équilibre ;
* la stabilité ;
* le contrôle moteur ;
* la coordination ;
* la qualité d’exécution.

Exemple :

Séance Proprioception
├── Session d’équilibre sur une jambe niveau 2
├── Session de planche latérale niveau 2
└── Session de bird dog niveau 2

⸻

Template de session

Un Template de session est l'objet administrable utilisé pour préparer la
programmation. Il contient :

* un titre ;
* une description ;
* un exercice ;
* un ou plusieurs niveaux autorisés ;
* un statut actif ou inactif.

Le pilier et la famille sont ceux de l'exercice sélectionné. Ils ne sont pas
dupliqués dans le template. Le format n'est pas fixé dans le template : il est
sélectionné dynamiquement lors de la génération du programme.

⸻

Session exécutable

Une Session exécutable correspond à l’exécution programmée d’un exercice pour
un niveau donné dans une séance.

Une session associe :

* un exercice ;
* un format ;
* un niveau de difficulté.

Définition courte :

Session exécutable = Template de session + Format sélectionné + Niveau

Exemples :

Session de pompes niveau 3
Session de jumping jack niveau 2
Session de gainage niveau 1
Session de planche latérale niveau 4

Une session ne correspond pas à l’entraînement complet.
Elle correspond à un exercice précis, exécuté selon un format précis, avec une difficulté adaptée au niveau de l’utilisateur ou de la séance.

⸻

Niveau

Le Niveau correspond au niveau de difficulté d’une session.

Il représente le niveau du couple :

Exercice + Format

Le niveau ne dépend pas uniquement de l’exercice.
Il dépend aussi du format utilisé.

Exemple :

Pompes niveau 2 : 3 séries de 6 répétitions
Pompes niveau 4 : 4 séries de 10 répétitions
Pompes niveau 6 : 5 séries de 12 répétitions

Un même exercice peut donc exister dans plusieurs niveaux selon :

* le nombre de séries ;
* le nombre de répétitions ;
* la durée des intervalles ;
* le temps de repos ;
* le tempo ;
* la variation technique ;
* l’amplitude ;
* l’impact ;
* la complexité du mouvement.

Exemple d’un entraînement avec plusieurs niveaux par séance :

Entraînement du jour
├── Séance Renforcement
│   └── Session de pompes niveau 2
├── Séance Cardio
│   └── Session de jumping jack niveau 3
└── Séance Proprioception
    └── Session d’équilibre niveau 2

⸻

Exercice

Un Exercice correspond au mouvement, à la posture ou à l’action physique à réaliser.

L’exercice décrit ce que l’utilisateur doit faire.

Exemples :

Pompes
Squats
Jumping jacks
Mountain climbers
Gainage
Planche latérale
Équilibre sur une jambe
Bird dog

L’exercice est une entrée du catalogue.

Il possède des propriétés propres :

* pilier ;
* difficulté ;
* impact ;
* famille ;
* type ;
* groupes musculaires ;
* équipement ;
* état de publication ;
* état de révision.

L’exercice seul ne définit pas la quantité de travail.
La quantité de travail est définie par le format.

⸻

Format

Un Format correspond au type d’exécution de l’exercice.

Il définit comment l’exercice doit être réalisé dans une session.

Le format associe obligatoirement :

* le nombre de séries ;
* soit un nombre de répétitions, soit un intervalle ;
* un temps de repos.

Les quantités sont lues depuis ces associations. Elles ne sont pas recopiées
dans le format sous forme de colonnes numériques dérivées.

Exemples :

3 séries de 8 répétitions avec 60 secondes de repos
4 séries de 12 répétitions avec 45 secondes de repos
6 séries de 30 secondes avec 30 secondes de repos
1 série du maximum de répétitions

Le format permet d’adapter un même exercice à plusieurs niveaux.

⸻

Série

Une Série correspond au nombre de fois que l’on exécute une phase d’effort suivie d’une phase de récupération.

Définition courte :

Série = Effort + Repos

En renforcement :

1 série = X répétitions + repos

En cardio :

1 série = X secondes d’effort + repos

En proprioception :

1 série = X répétitions contrôlées ou X secondes de maintien + repos

Exemple :

4 séries de 10 répétitions
= 4 fois :
  - 10 répétitions
  - repos

⸻

Répétition

Une Répétition correspond à une exécution complète d’un mouvement.

Elle est principalement utilisée pour les formats de renforcement, mais peut aussi être utilisée pour certains exercices de proprioception ou de mobilité contrôlée.

Définition métier :

Répétition = phase d’effort répétée X fois

Le catalogue contient des répétitions numériques fixes et une unique valeur
`Maximum`. Cette dernière signifie que le nombre de répétitions n'est pas fixé
à l'avance.

Le contrôle du mouvement et l'arrêt à l'échec sont des consignes d'exécution
de l'exercice. Ils ne constituent pas des types de répétition stockés dans le
catalogue.

Exemples :

8 répétitions de pompes
12 répétitions de squats
Maximum de répétitions jusqu’à l’échec

Définition complète :

Une répétition correspond à une phase d’effort répétée un nombre défini de fois, ou répétée le maximum de fois possible jusqu’à l’échec.

⸻

Intervalle

Un Intervalle correspond à une phase d’effort chronométrée.

Il est principalement utilisé pour les séances cardio, mais peut aussi être utilisé pour les séances proprioception, gainage, mobilité ou maintien postural.

Définition métier :

Intervalle = phase d’effort pendant une durée définie

Pendant un intervalle, l’utilisateur peut :

* répéter le mouvement le plus de fois possible jusqu’à la fin du temps défini ;
* maintenir une position jusqu’à la fin du temps défini ;
* contrôler chaque mouvement jusqu’à la fin du temps défini ;
* arrêter avant la fin si l’échec technique ou musculaire est atteint.

Ces modes d'exécution ne qualifient pas l'intervalle en base. Un intervalle
porte uniquement une durée d'effort. Le maintien, le contrôle et l'exécution
maximale relèvent de l'exercice et de ses consignes.

Exemples :

30 secondes de jumping jacks
40 secondes de mountain climbers
45 secondes de gainage
30 secondes d’équilibre sur une jambe

Définition complète :

Un intervalle correspond à une phase d’effort chronométrée pendant laquelle l’utilisateur répète, maintient ou contrôle un exercice jusqu’à la fin du temps défini, ou jusqu’à l’échec si le format le prévoit.

⸻

Repos

Le Repos correspond à la phase de récupération en alternance avec les phases d’effort.

Il est placé après une phase de répétitions ou après un intervalle.

Exemples :

30 secondes de repos
45 secondes de repos
60 secondes de repos
90 secondes de repos

Le repos permet :

* de récupérer ;
* de maintenir la qualité d’exécution ;
* d’adapter la difficulté ;
* de gérer l’intensité ;
* de préparer la série suivante.

Définition courte :

Repos = phase de récupération après l’effort

⸻
