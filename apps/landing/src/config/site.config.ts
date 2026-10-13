const landingOrigin =
    import.meta.env.PUBLIC_SITE_ORIGIN ?? "https://acrea-fitness.fr";
const appOrigin =
    import.meta.env.PUBLIC_APP_ORIGIN ?? "https://app.acrea-fitness.fr";

function readPublicEnv(name: string) {
    const value = import.meta.env[name]?.trim();
    return value || null;
}

export const legalPaths = {
    terms: "/conditions-generales-utilisation/",
    privacy: "/politique-de-confidentialite/",
    cookies: "/cookies/",
    legalNotice: "/mentions-legales/",
} as const;

const publisher = {
    name: readPublicEnv("PUBLIC_LEGAL_ENTITY_NAME"),
    registeredOffice: readPublicEnv("PUBLIC_LEGAL_REGISTERED_OFFICE"),
    publicationDirector: readPublicEnv("PUBLIC_LEGAL_PUBLICATION_DIRECTOR"),
    privacyContact: readPublicEnv("PUBLIC_LEGAL_PRIVACY_CONTACT"),
    dataRetention: readPublicEnv("PUBLIC_LEGAL_DATA_RETENTION"),
};

export const legalConfig = {
    updatedAt: "25 août 2026",
    publisher,
    host: {
        name: "Cloudflare, Inc.",
        address: "101 Townsend St., San Francisco, CA 94107, États-Unis",
        phone: "+1 (650) 319-8930",
        website: "https://www.cloudflare.com/",
    },
    pendingValue: "À renseigner avant publication en production",
};

export const siteConfig = {
    name: "ACREA Fitness",
    title: "ACREA Fitness | Programme personnalisé au poids du corps",
    description:
        "ACREA Fitness structure chaque semaine des séances de renforcement, cardio et proprioception au poids du corps, avec test de niveau et guidage dans l'application.",
    baseUrl: landingOrigin,
    lang: "fr",
    locale: "fr_FR",
    themeColor: "#090d10",
    socialImagePath: "/social/acrea-fitness-og.webp",
    app: {
        baseUrl: appOrigin,
        homePath: "/home",
        loginPath: "/login",
        signupPath: null,
    },
    navigation: [
        { label: "Méthode", href: "#methode" },
        { label: "ACREA", href: "#acrea" },
        { label: "Fonctionnalités", href: "#fonctionnalites" },
        { label: "IA", href: "#intelligence" },
        { label: "Application", href: "#application" },
    ],
    cta: {
        primaryLabel: "Commencer mon programme",
        secondaryLabel: "Ouvrir l'application",
        loginLabel: "Se connecter",
    },
};

export const legalNavigation = [
    { label: "Mentions légales", href: legalPaths.legalNotice },
    { label: "Confidentialité", href: legalPaths.privacy },
    { label: "CGU", href: legalPaths.terms },
    { label: "Cookies", href: legalPaths.cookies },
];

export const pillars = [
    {
        icon: "dumbbell",
        title: "Renforcement",
        description:
            "Construire une base solide grâce à des mouvements au poids du corps adaptés au niveau évalué.",
    },
    {
        icon: "heart-pulse",
        title: "Cardio",
        description:
            "Développer l'endurance avec des formats rythmés qui s'intègrent à la progression hebdomadaire.",
    },
    {
        icon: "activity",
        title: "Proprioception",
        description:
            "Travailler l'équilibre, le contrôle et la stabilité pour mieux maîtriser chaque mouvement.",
    },
];

export const features = [
    {
        icon: "timer",
        title: "Minuteur structuré",
        description:
            "Les séries, intervalles et récupérations restent lisibles pendant l'effort.",
    },
    {
        icon: "volume-2",
        title: "Repères audio",
        description:
            "Choisir entre sons, voix ou silence selon le contexte de la séance.",
    },
    {
        icon: "message-square-check",
        title: "Feedback de séance",
        description:
            "Noter le ressenti après l'entraînement pour conserver un suivi utile.",
    },
    {
        icon: "wifi-off",
        title: "Disponible localement",
        description:
            "La bibliothèque et les données déjà enregistrées restent accessibles sans connexion continue.",
    },
];

export const aiFlow = [
    {
        title: "Prendre en compte votre contexte",
        description:
            "Le niveau évalué, l'objectif, le rythme choisi, le temps disponible, le matériel et les restrictions structurent la demande.",
    },
    {
        title: "Composer une semaine cohérente",
        description:
            "Le moteur sélectionne les exercices et leurs formats en respectant les jours choisis, la durée ciblée et les trois piliers ACREA.",
    },
    {
        title: "Tenir compte des retours",
        description:
            "Le feedback de séance, les préférences d'exercices, la fatigue et la douleur signalée encadrent les propositions suivantes.",
    },
];

export const steps = [
    {
        number: "01",
        title: "Créer un compte",
        description:
            "Rejoindre l'application avec le flux d'inscription déjà intégré à la connexion.",
    },
    {
        number: "02",
        title: "Évaluer son niveau",
        description:
            "Réaliser le test ACREA pour définir un point de départ cohérent.",
    },
    {
        number: "03",
        title: "Suivre sa semaine",
        description:
            "Retrouver les séances prévues et avancer à son rythme dans l'application.",
    },
];
