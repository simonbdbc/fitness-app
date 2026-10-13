export type AppView =
  | "home"
  | "bibliotheque"
  | "profile"
  | "levelTest"
  | "training"
  | "timer"
  | "settings"
  | "pwaDashboard"
  | "install"
  | "uninstall"
  | "adminCatalogExercises"
  | "adminCatalogLevels"
  | "adminCatalogSessions"
  | "adminCatalogFormats"
  | "adminCatalogSeries"
  | "adminCatalogRepetitions"
  | "adminCatalogIntervals"
  | "adminCatalogRests"
  | "adminCatalogEquipment";

export const appViewDisplayNameByView: Record<AppView, string> = {
  home: "Accueil",
  bibliotheque: "Bibliothèque",
  profile: "Profil",
  levelTest: "Évaluation de niveau",
  training: "Entraînement",
  timer: "Minuteur",
  settings: "Paramètres",
  pwaDashboard: "Tableau de bord PWA",
  install: "Installation",
  uninstall: "Désinstallation",
  adminCatalogExercises: "Exercices",
  adminCatalogLevels: "Niveaux",
  adminCatalogSessions: "Sessions",
  adminCatalogFormats: "Formats",
  adminCatalogSeries: "Séries",
  adminCatalogRepetitions: "Répétitions",
  adminCatalogIntervals: "Intervalles",
  adminCatalogRests: "Repos",
  adminCatalogEquipment: "Équipements",
};

export const routeByView: Record<AppView, string> = {
  home: "/home",
  bibliotheque: "/bibliotheque",
  profile: "/profile",
  levelTest: "/level-test",
  training: "/training",
  timer: "/timer",
  settings: "/settings",
  pwaDashboard: "/pwa",
  install: "/install",
  uninstall: "/uninstall",
  adminCatalogExercises: "/admin/catalogue/exercices",
  adminCatalogLevels: "/admin/catalogue/niveaux",
  adminCatalogSessions: "/admin/catalogue/sessions",
  adminCatalogFormats: "/admin/catalogue/formats",
  adminCatalogSeries: "/admin/catalogue/series",
  adminCatalogRepetitions: "/admin/catalogue/repetitions",
  adminCatalogIntervals: "/admin/catalogue/intervalles",
  adminCatalogRests: "/admin/catalogue/repos",
  adminCatalogEquipment: "/admin/catalogue/equipements",
};

export function viewFromPathname(pathname: string): AppView {
  if (pathname.startsWith("/admin/catalogue/exercices")) {
    return "adminCatalogExercises";
  }

  if (
    pathname.startsWith("/admin/catalogue/niveaux") ||
    pathname.startsWith("/admin/catalogue/niveaux-formats")
  ) {
    return "adminCatalogLevels";
  }

  if (pathname.startsWith("/admin/catalogue/sessions")) {
    return "adminCatalogSessions";
  }

  if (pathname.startsWith("/admin/catalogue/formats")) {
    return "adminCatalogFormats";
  }

  if (pathname.startsWith("/admin/catalogue/series")) {
    return "adminCatalogSeries";
  }

  if (pathname.startsWith("/admin/catalogue/repetitions")) {
    return "adminCatalogRepetitions";
  }

  if (pathname.startsWith("/admin/catalogue/intervalles")) {
    return "adminCatalogIntervals";
  }

  if (pathname.startsWith("/admin/catalogue/repos")) {
    return "adminCatalogRests";
  }

  if (pathname.startsWith("/admin/catalogue/equipements")) {
    return "adminCatalogEquipment";
  }

  if (pathname.startsWith("/bibliotheque")) {
    return "bibliotheque";
  }

  if (pathname.startsWith("/catalogue")) {
    return "bibliotheque";
  }

  if (pathname.startsWith("/profile")) {
    return "profile";
  }

  if (pathname.startsWith("/level-test")) {
    return "levelTest";
  }

  if (pathname.startsWith("/training")) {
    return "training";
  }

  if (pathname.startsWith("/timer")) {
    return "timer";
  }

  if (pathname.startsWith("/settings")) {
    return "settings";
  }

  if (pathname.startsWith("/pwa")) {
    return "pwaDashboard";
  }

  if (pathname.startsWith("/install")) {
    return "install";
  }

  if (pathname.startsWith("/uninstall")) {
    return "uninstall";
  }

  return "home";
}
