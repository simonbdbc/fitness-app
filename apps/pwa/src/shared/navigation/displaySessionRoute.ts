import {
  displaySessionStorageKey,
  readDisplaySessionState,
  writeDisplaySessionState,
} from "@shared/persistence";

const protectedPathnames = new Set([
  "/home",
  "/bibliotheque",
  "/profile",
  "/level-test",
  "/training",
  "/timer",
  "/settings",
  "/pwa",
  "/install",
  "/uninstall",
  "/admin/catalogue/exercices",
  "/admin/catalogue/niveaux",
  "/admin/catalogue/sessions",
  "/admin/catalogue/formats",
  "/admin/catalogue/series",
  "/admin/catalogue/repetitions",
  "/admin/catalogue/intervalles",
  "/admin/catalogue/repos",
  "/admin/catalogue/equipements",
]);

export function displaySessionRouteStorageKey(userId: string) {
  return displaySessionStorageKey(userId, "route:current");
}

export async function readDisplaySessionRoute({
  canAccessAdminCatalog,
  userId,
}: {
  canAccessAdminCatalog: boolean;
  userId: string;
}) {
  return readDisplaySessionState(
    displaySessionRouteStorageKey(userId),
    (value) =>
      isRestorableProtectedPathname(value, canAccessAdminCatalog)
        ? value
        : null,
  );
}

export async function writeDisplaySessionRoute(
  userId: string,
  pathname: string,
) {
  if (!isRestorableProtectedPathname(pathname, true)) return;
  await writeDisplaySessionState(
    displaySessionRouteStorageKey(userId),
    pathname,
  );
}

export function isRestorableProtectedPathname(
  pathname: unknown,
  canAccessAdminCatalog: boolean,
): pathname is string {
  return (
    typeof pathname === "string" &&
    protectedPathnames.has(pathname) &&
    (canAccessAdminCatalog || !pathname.startsWith("/admin/"))
  );
}
