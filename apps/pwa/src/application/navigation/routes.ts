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
};

export function viewFromPathname(pathname: string): AppView {
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
