import type { ACREACategory, ACREAPillar } from "./acreaSeed";

export type ACREAEntryTestExerciseCode =
  | "renforcement-strict-pushups"
  | "renforcement-bodyweight-squats"
  | "cardio-burpee-sans-pompe"
  | "cardio-mountain-climber-controle"
  | "proprioception-leg-raise"
  | "proprioception-planche-lean";

export type ACREAEntryEvaluationPrescription = {
  repetitions: number;
  series: number;
};

export type ACREAEntryScoreMetric = {
  label: string;
  unit: "reps";
  helper: string;
};

export type ACREAEntryTestStage = {
  label: string;
  objective: string;
};

export type ACREAEntryTestExercise = {
  code: ACREAEntryTestExerciseCode;
  exerciseSlug: string;
  name: string;
  shortName: string;
  protocolRole: string;
  pillar: ACREAPillar;
  acreaCategory: ACREACategory;
  equipment: string;
  objective: string;
  setup: string[];
  execution: string[];
  amplitudeRule: string;
  breathing: string;
  stopRule: string;
  commonMistakes: string[];
  acreaAdaptation: string;
  regressionNote: string;
  scoreMetric: ACREAEntryScoreMetric;
  phasePrescriptions: Record<1 | 2, ACREAEntryEvaluationPrescription>;
  levelThresholds: {
    level2Minimum: number;
    level3Minimum: number;
  };
};

export const acreaPillarTerm = "3 piliers ACREA";

export const acreaEntryTestStages: ACREAEntryTestStage[] = [
  {
    label: "Séance 1",
    objective: "Valider le premier format propre à chaque exercice.",
  },
  {
    label: "Séance 2",
    objective: "Valider le second format propre à chaque exercice.",
  },
  {
    label: "Séance 3",
    objective: "Maximum propre avant échec technique.",
  },
];

export const acreaEntryTestExercises: ACREAEntryTestExercise[] = [
  {
    code: "renforcement-strict-pushups",
    exerciseSlug: "push-up",
    name: "Pompes strictes",
    shortName: "Pompes",
    protocolRole: "Renforcement 1/2",
    pillar: "strength",
    acreaCategory: "poussee",
    equipment: "Sol stable",
    objective: "Mesurer la poussée horizontale fondamentale sans matériel.",
    setup: [
      "Mains sous ou légèrement plus larges que les épaules.",
      "Pieds au sol, corps gainé des épaules aux chevilles.",
      "Nuque neutre, bassin aligné, appuis fixes.",
    ],
    execution: [
      "Effectuer le plus de répétitions propres possible.",
      "Descendre en bloc, sans casser la ligne du corps.",
      "Remonter jusqu'aux bras tendus sans rebond.",
    ],
    amplitudeRule:
      "Poitrine proche du sol en bas, bras tendus en haut. Une demi-répétition ne compte pas.",
    breathing: "Inspirer sur la descente, souffler sur la poussée.",
    stopRule:
      "Arrêter quand le bassin s'affaisse, que l'amplitude raccourcit ou que les épaules compensent.",
    commonMistakes: [
      "Creuser le bas du dos pour passer une rep.",
      "Raccourcir la descente.",
      "Marquer des pauses longues entre les répétitions.",
    ],
    acreaAdaptation:
      "Ajuste la variante de poussée: pompe murale, inclinée, stricte, tempo ou déclinée.",
    regressionNote:
      "Si aucune rep stricte n'est possible, note 0. Le programme démarrera sur une variante plus facile.",
    scoreMetric: {
      label: "Répétitions strictes",
      unit: "reps",
      helper: "Nombre total de pompes strictes avant dégradation technique.",
    },
    phasePrescriptions: {
      1: { repetitions: 8, series: 2 },
      2: { repetitions: 8, series: 3 },
    },
    levelThresholds: { level2Minimum: 20, level3Minimum: 50 },
  },
  {
    code: "renforcement-bodyweight-squats",
    exerciseSlug: "air-squat",
    name: "Squats poids du corps",
    shortName: "Squats",
    protocolRole: "Renforcement 2/2",
    pillar: "strength",
    acreaCategory: "jambes",
    equipment: "Aucun",
    objective:
      "Évaluer l'endurance musculaire des jambes et la régularité d'amplitude.",
    setup: [
      "Pieds stables, environ largeur de bassin ou légèrement plus.",
      "Buste grand, regard devant, poids réparti sur tout le pied.",
      "Bras libres pour équilibrer sans tirer sur un support.",
    ],
    execution: [
      "Effectuer le plus de répétitions propres possible.",
      "Descendre avec genoux dans l'axe des pieds.",
      "Remonter complètement sans rebond agressif.",
    ],
    amplitudeRule:
      "Descendre au moins jusqu'à une amplitude confortable et répétable. Les reps partielles ne comptent pas.",
    breathing: "Inspirer en descente, souffler en remontée.",
    stopRule:
      "Arrêter si les talons se décollent, si les genoux rentrent ou si le dos s'arrondit fortement.",
    commonMistakes: [
      "Réduire l'amplitude après quelques reps.",
      "Faire rebondir les genoux vers l'intérieur.",
      "Accélérer au point de perdre la posture.",
    ],
    acreaAdaptation:
      "Ajuste la progression jambes: squat assisté, squat complet, squat tempo, split squat.",
    regressionNote:
      "Si l'amplitude libre n'est pas stable, note seulement les reps propres et garde une variante assistée.",
    scoreMetric: {
      label: "Répétitions propres",
      unit: "reps",
      helper: "Nombre total de squats propres avant perte d'amplitude.",
    },
    phasePrescriptions: {
      1: { repetitions: 12, series: 2 },
      2: { repetitions: 12, series: 3 },
    },
    levelThresholds: { level2Minimum: 30, level3Minimum: 80 },
  },
  {
    code: "cardio-burpee-sans-pompe",
    exerciseSlug: "burpee",
    name: "Burpee sans pompe",
    shortName: "Burpees sans pompe",
    protocolRole: "Cardio 1/2",
    pillar: "cardio",
    acreaCategory: "conditioning",
    equipment: "Aucun",
    objective:
      "Mesurer la capacité à répéter un mouvement cardio complet sans perdre le contrôle.",
    setup: [
      "Debout, espace dégagé, mains prêtes à se poser au sol.",
      "Reculer ou sauter les pieds selon le niveau, sans pompe.",
      "Choisir un rythme soutenable dès la première rep.",
    ],
    execution: [
      "Effectuer le plus de répétitions propres possible.",
      "Passer de debout à planche haute puis revenir debout.",
      "Garder les appuis contrôlés et la respiration active.",
    ],
    amplitudeRule:
      "La rep compte si la planche haute est stable et si le retour debout est complet.",
    breathing:
      "Respiration continue; ralentir plutôt que bloquer ou s'effondrer.",
    stopRule:
      "Arrêter si le dos s'arrondit fortement, si la planche devient instable ou si l'essoufflement empêche le contrôle.",
    commonMistakes: [
      "Tomber au sol au lieu de poser les mains.",
      "Revenir debout sans extension complète.",
      "Transformer le test en course désordonnée.",
    ],
    acreaAdaptation:
      "Ajuste les formats Cardio: low impact, 30/30, 40/20, EMOM ou circuits courts.",
    regressionNote:
      "Si le passage au sol est trop dur, note le score propre puis le programme utilisera une variante low impact.",
    scoreMetric: {
      label: "Répétitions propres",
      unit: "reps",
      helper:
        "Nombre total de burpees sans pompe réalisés sans perte de contrôle.",
    },
    phasePrescriptions: {
      1: { repetitions: 8, series: 2 },
      2: { repetitions: 8, series: 3 },
    },
    levelThresholds: { level2Minimum: 20, level3Minimum: 50 },
  },
  {
    code: "cardio-mountain-climber-controle",
    exerciseSlug: "mountain-climber",
    name: "Mountain climber contrôlé",
    shortName: "Mountain climber",
    protocolRole: "Cardio 2/2",
    pillar: "cardio",
    acreaCategory: "conditioning",
    equipment: "Aucun",
    objective:
      "Tester l'effort cardio en planche, avec gainage actif et cadence maîtrisée.",
    setup: [
      "Position planche haute, mains sous les épaules.",
      "Corps aligné, appuis stables.",
      "Cadence modérée au départ pour garder le bassin stable.",
    ],
    execution: [
      "Effectuer le plus de répétitions propres possible.",
      "Ramener les genoux alternativement sous le buste.",
      "Compter chaque montée de genou contrôlée.",
    ],
    amplitudeRule:
      "Chaque rep compte si le genou avance clairement et si la ligne épaules-bassin reste contrôlée.",
    breathing: "Respiration courte et régulière pendant tout l'exercice.",
    stopRule:
      "Arrêter si le bassin monte, si les poignets deviennent douloureux ou si la cadence devient désordonnée.",
    commonMistakes: [
      "Courir sur place sans contrôle du tronc.",
      "Laisser les épaules partir derrière les mains.",
      "Compter des mouvements trop courts.",
    ],
    acreaAdaptation:
      "Ajuste les circuits Cardio qui mélangent core et cardio sans saut.",
    regressionNote:
      "Si la planche haute est trop dure, note le score strict puis le programme utilisera une régression.",
    scoreMetric: {
      label: "Répétitions alternées",
      unit: "reps",
      helper: "Chaque montée de genou contrôlée compte pour une rep.",
    },
    phasePrescriptions: {
      1: { repetitions: 16, series: 2 },
      2: { repetitions: 16, series: 3 },
    },
    levelThresholds: { level2Minimum: 40, level3Minimum: 90 },
  },
  {
    code: "proprioception-leg-raise",
    exerciseSlug: "lying-leg-raise",
    name: "Relevés de jambes au sol",
    shortName: "Relevés de jambes",
    protocolRole: "Proprioception 1/2",
    pillar: "proprioception",
    acreaCategory: "core",
    equipment: "Tapis optionnel",
    objective:
      "Évaluer le gainage actif utile aux progressions de L-sit et de lignes corporelles.",
    setup: [
      "Allongé sur le dos, mains posées au sol ou sous le bassin si nécessaire.",
      "Bas du dos contrôlé, jambes tendues ou légèrement fléchies.",
      "Respiration possible avant de commencer.",
    ],
    execution: [
      "Effectuer le plus de répétitions propres possible.",
      "Monter les jambes sans élan puis redescendre sous contrôle.",
      "Arrêter avant que le bas du dos se creuse.",
    ],
    amplitudeRule:
      "La rep compte si la montée et la descente restent contrôlées, sans compensation lombaire.",
    breathing: "Souffler pendant la montée, inspirer pendant la descente.",
    stopRule:
      "Arrêter si le bas du dos se creuse, si la nuque tire ou si la descente devient incontrôlée.",
    commonMistakes: [
      "Lancer les jambes avec élan.",
      "Creuser le bas du dos pour continuer.",
      "Raccourcir fortement l'amplitude.",
    ],
    acreaAdaptation:
      "Ajuste les prérequis: dead bug, hollow, relevés de jambes et préparation L-sit.",
    regressionNote:
      "Plie les genoux si besoin, mais note seulement les répétitions propres.",
    scoreMetric: {
      label: "Répétitions propres",
      unit: "reps",
      helper:
        "Nombre total de relevés propres avant perte de ligne ou douleur.",
    },
    phasePrescriptions: {
      1: { repetitions: 8, series: 2 },
      2: { repetitions: 8, series: 3 },
    },
    levelThresholds: { level2Minimum: 20, level3Minimum: 50 },
  },
  {
    code: "proprioception-planche-lean",
    exerciseSlug: "lean-planche",
    name: "Planche lean dynamique",
    shortName: "Planche lean",
    protocolRole: "Proprioception 2/2",
    pillar: "proprioception",
    acreaCategory: "skill",
    equipment: "Sol stable ou parallettes",
    objective:
      "Évaluer le contrôle des appuis, du gainage et de l’inclinaison vers l’avant.",
    setup: [
      "Place les mains au sol ou sur des parallettes stables, bras tendus.",
      "Gaine le corps et verrouille les coudes sans hausser les épaules.",
      "Commence avec les épaules à l’aplomb des mains.",
    ],
    execution: [
      "Effectuer le plus de répétitions propres possible.",
      "Avancer les épaules au-delà des mains, bras tendus, sans plier les coudes.",
      "Effectuer un retour contrôlé à la position de départ pour valider une répétition.",
    ],
    amplitudeRule:
      "La répétition compte si les épaules dépassent clairement les mains puis reviennent à l’aplomb, sans rupture du gainage.",
    breathing: "Souffler en avançant, inspirer pendant le retour contrôlé.",
    stopRule:
      "Arrêter si les coudes se plient, si le bassin s’affaisse ou si les poignets deviennent douloureux.",
    commonMistakes: [
      "Plier les coudes pour gagner de l’amplitude.",
      "Avancer uniquement la tête au lieu du corps gainé.",
      "Rebondir sur les poignets au retour.",
    ],
    acreaAdaptation:
      "Ajuste les appuis de planche, la protraction et les progressions de planche.",
    regressionNote:
      "Réduis l’inclinaison si nécessaire, mais compte uniquement les allers-retours complets et gainés.",
    scoreMetric: {
      label: "Leans dynamiques stricts",
      unit: "reps",
      helper: "Nombre total d’allers-retours stricts avant perte de gainage.",
    },
    phasePrescriptions: {
      1: { repetitions: 6, series: 2 },
      2: { repetitions: 6, series: 3 },
    },
    levelThresholds: { level2Minimum: 10, level3Minimum: 30 },
  },
];

export const acreaEntryProtocolRules = [
  "L’évaluation de niveau comprend trois séances successives.",
  "Chaque séance contient deux exercices représentatifs par pilier ACREA.",
  "Les séances 1 et 2 utilisent les prescriptions propres à chaque exercice.",
  "La séance 3 mesure le maximum de répétitions propres sur chaque exercice.",
  "Prends librement 2 à 3 minutes de récupération entre chaque exercice.",
  "Le score de la séance maximale utilise les seuils propres à chaque exercice.",
  "Le niveau d'un pilier est le plus bas résultat de ses deux exercices.",
];

export const acreaEntryWarmupItems = [
  "Mobilité poignets, épaules et hanches, 60 à 90 secondes.",
  "Squats faciles, 8 à 12 reps sans fatigue.",
  "Pompes très faciles ou inclinées, 2 séries courtes.",
  "Planche haute et gainage léger, 20 à 30 secondes.",
  "Rétraction scapulaire ou tirage très facile si un support est disponible.",
  "Respiration calme et vérification des supports avant le repos pré-test.",
];
