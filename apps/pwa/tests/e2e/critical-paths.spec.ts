import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await openLocalSession(page);
});

test("the mobile side menu uses SVG controls to open and close", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });

  const openMenuButton = page.getByRole("button", {
    name: "Ouvrir le menu",
  });
  await expect(openMenuButton.locator("svg")).toHaveCount(1);
  await expect(openMenuButton).not.toContainText(/Menu|Fermer/);

  await openMenuButton.click();

  const closeMenuButtons = page.getByRole("button", {
    name: "Fermer le menu",
  });
  await expect(closeMenuButtons).toHaveCount(2);
  await expect(closeMenuButtons.last().locator("svg")).toHaveCount(1);
  await expect(closeMenuButtons.last()).not.toContainText("Fermer");

  await closeMenuButtons.last().click();

  await expect(openMenuButton).toBeVisible();
  await expect(closeMenuButtons).toHaveCount(0);
});

test("installed mode hides the menu entry and keeps PWA settings access", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await emulateInstalledDisplayMode(page);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByText("App installee", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Fermer le menu" }).last().click();

  await page.getByRole("button", { name: "Tableau de bord PWA" }).click();
  await expect(page).toHaveURL(/\/pwa$/);
});

test("installation and uninstallation return to the PWA dashboard", async ({
  page,
}) => {
  await page.goto("/install");
  await expect(
    page.getByText("Installer l'application", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tableau de bord PWA" }).click();
  await expect(page).toHaveURL(/\/pwa$/);
  await expect(
    page.getByText("Tableau de bord PWA", { exact: true }).last(),
  ).toBeVisible();

  await page.goto("/uninstall");
  await expect(
    page.getByText("Desinstaller l'application", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tableau de bord PWA" }).click();
  await expect(page).toHaveURL(/\/pwa$/);
});

test("the API badge never reports success without a configured healthcheck", async ({
  page,
}) => {
  await page.route("**/health", (route) => route.abort());
  await page.goto("/pwa");
  await expect(
    page
      .locator(
        '[title="API indisponible"], [title="API non configurée"], [aria-label="API indisponible"], [aria-label="API non configurée"]',
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText("API backend", { exact: true })
      .locator("..")
      .getByText(/^(non configurée|indisponible)$/),
  ).toBeVisible();
  await expect(page.getByText("API disponible")).toHaveCount(0);
});

test("the light switch is the inverse of the dark default and persists", async ({
  page,
}) => {
  const lightSwitch = page.getByLabel("Thème clair");

  await expect(lightSwitch).not.toBeChecked();
  await lightSwitch.click();
  await expect(lightSwitch).toBeChecked();
  await expect(page.getByText("Clair", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Thème clair")).toBeChecked();
});

test("a repetition timer starts, pauses and resumes through rendered controls", async ({
  page,
}) => {
  // A fresh Chromium profile must render the timer from its embedded offline
  // core; downloading the full exercise library is never a prerequisite.
  test.setTimeout(120_000);
  await page.goto("/timer");
  await expect(page.getByText("Minuteur", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Démarrer" }).click();
  await expect(page.getByRole("button", { name: "Annuler" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Série terminée" }),
  ).toBeVisible({ timeout: 8_000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Reprendre" })).toBeVisible();
  await page.getByRole("button", { name: "Reprendre" }).click();
  await expect(
    page.getByRole("button", { name: "Série terminée" }),
  ).toBeVisible({ timeout: 8_000 });
});

test("a running timer keeps its mounted route and restores after remount", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await emulateInstalledDisplayMode(page);
  await page.goto("/timer");
  await waitForServiceWorkerControl(page);
  await expect(page.getByText("Minuteur", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Démarrer" }).click();
  await expect(
    page.getByRole("button", { name: "Série terminée" }),
  ).toBeVisible({ timeout: 8_000 });
  const mountedShell = await page
    .locator('[id^="protected-app-"]')
    .elementHandle();

  await setDocumentVisibility(page, "hidden");
  await expect(page).toHaveURL(/\/timer$/);
  await setDocumentVisibility(page, "visible");
  await expect(page).toHaveURL(/\/timer$/);
  expect(await mountedShell?.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  await expect(page.getByLabel("Chargement du profil")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Série terminée" }),
  ).toBeVisible();

  await page.goto("/settings");
  await page.goto("/timer");
  await expect(page).toHaveURL(/\/timer$/);
  await expect(page.getByRole("button", { name: "Reprendre" })).toBeVisible();
});

test("an installed training route stays mounted while foregrounding", async ({
  page,
}) => {
  await emulateInstalledDisplayMode(page);
  await page.goto("/training");
  await waitForServiceWorkerControl(page);
  await expect(page).toHaveURL(/\/training$/);
  await expect(
    page.getByText("Entraînement", { exact: true }).last(),
  ).toBeVisible();
  const mountedShell = await page
    .locator('[id^="protected-app-"]')
    .elementHandle();

  await setDocumentVisibility(page, "hidden");
  await setDocumentVisibility(page, "visible");

  await expect(page).toHaveURL(/\/training$/);
  expect(await mountedShell?.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  await expect(page.getByLabel("Chargement du profil")).toHaveCount(0);
});

test("the library restores its pillar filter and plays an exercise animation only on click", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/bibliotheque");
  await expect(page.getByText("Vue d'ensemble", { exact: true })).toBeVisible();
  await expect(page.getByText("Burpee", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Afficher les filtres" }).click();
  await expect(page.getByLabel("Rechercher un exercice")).toBeVisible();
  const pillarFilters = page.getByText("Pilier", { exact: true }).locator("..");
  await expect(pillarFilters.getByRole("button", { name: "Tous" })).toHaveCount(
    0,
  );
  await pillarFilters
    .getByRole("button", { name: "Proprioception" })
    .click();
  await expect(page.getByText("Lean Planche", { exact: true })).toBeVisible();

  await navigateFromMenu(page, "Paramètres", /\/settings$/);
  await navigateFromMenu(page, "Bibliothèque", /\/bibliotheque$/);
  await expect(page.getByText("Lean Planche", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Voir le détail de Lean Planche" })
    .click();
  await expect(
    page.getByRole("img", { name: "Aperçu de Lean Planche" }).last(),
  ).toBeVisible();
  await expect(page.getByTestId("exercise-play-overlay")).toBeVisible();
  await page
    .getByRole("button", { name: "Lire l’animation de Lean Planche" })
    .click();
  await expect(
    page.getByRole("img", { name: "Animation de Lean Planche" }).last(),
  ).toBeVisible();
  await expect(page.getByTestId("exercise-play-overlay")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Afficher l’aperçu de Lean Planche" })
    .click();
  await expect(
    page.getByRole("img", { name: "Aperçu de Lean Planche" }).last(),
  ).toBeVisible();
  await expect(page.getByTestId("exercise-play-overlay")).toBeVisible();
});

test("a local authentication session can be closed without a remote API", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByText("Connexion", { exact: true })).toBeVisible();
  await expect(
    page
      .getByPlaceholder("email")
      .or(page.getByRole("button", { name: "Continuer en session locale" })),
  ).toBeVisible();
});

test("a configured V4 profile without equipment completes its evaluation offline and can retry programme hydration", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await configureNoEquipmentProfile(page);
  await page.clock.install();
  await page.goto("/training");
  await expect(page.getByText("Évaluation de niveau requise", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ouvrir l’évaluation de niveau" }).click();
  await expect(page).toHaveURL(/\/level-test$/);
  await expect(page.getByText("Évaluation de niveau ACREA", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Commencer l’évaluation" }).click();
  await expect(page.getByText("Parcours en trois séances", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  await expect(page.getByText("Évaluation - séance 1/3", { exact: true })).toBeVisible();
  await expect(page.getByText("Échauffement général", { exact: true })).toBeVisible();

  await completeEvaluationSession(page, 1, 2);
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  await completeEvaluationSession(page, 2, 3);
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  await completeEvaluationSession(page, 3, 1, [20, 30, 20, 40, 20, 10]);

  await expect(page.getByText("Évaluation validée", { exact: true })).toBeVisible();
  await expect(page.getByText("Niveaux ACREA mis à jour", { exact: true })).toBeVisible();

  await page.goto("/training");
  await expect(page.getByText("Programme indisponible", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
});

test("a cold launch opens home", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
});

test("a new document runtime discards display state and opens home", async ({
  page,
}) => {
  await page.goto("/timer");
  await expect(page).toHaveURL(/\/timer$/);

  await page.reload();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("Accueil", { exact: true }).last()).toBeVisible();
});

test("scroll belongs to its route and survives foregrounding and remounting", async ({
  page,
}) => {
  await page.setViewportSize({ height: 480, width: 390 });
  await page.goto("/profile");
  await expect(page.getByText("Profil", { exact: true }).last()).toBeVisible();
  const scrollView = page.getByTestId("protected-scroll-view");
  await scrollView.evaluate((element) => {
    element.scrollTop = 320;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect
    .poll(() => scrollView.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  const profileOffset = await scrollView.evaluate(
    (element) => element.scrollTop,
  );

  await setDocumentVisibility(page, "hidden");
  await setDocumentVisibility(page, "visible");
  await expect
    .poll(() => scrollView.evaluate((element) => element.scrollTop))
    .toBe(profileOffset);

  await navigateFromMenu(page, "Paramètres", /\/settings$/);
  await navigateFromMenu(page, "Profil", /\/profile$/);
  await expect
    .poll(() => scrollView.evaluate((element) => element.scrollTop))
    .toBe(profileOffset);
});

async function emulateInstalledDisplayMode(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query === "(display-mode: standalone)"
        ? ({
            addEventListener() {},
            addListener() {},
            dispatchEvent: () => false,
            matches: true,
            media: query,
            onchange: null,
            removeEventListener() {},
            removeListener() {},
          } as MediaQueryList)
        : nativeMatchMedia(query);
  });
}

test("returning to the foreground keeps the current protected route", async ({
  page,
}) => {
  await page.goto("/level-test");
  await expect(page).toHaveURL(/\/level-test$/);
  const mountedShell = await page
    .locator('[id^="protected-app-"]')
    .elementHandle();

  await setDocumentVisibility(page, "hidden");
  await setDocumentVisibility(page, "visible");

  await expect(page).toHaveURL(/\/level-test$/);
  expect(await mountedShell?.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  await expect(page.getByLabel("Chargement du profil")).toHaveCount(0);
});

async function setDocumentVisibility(
  page: Page,
  visibilityState: "hidden" | "visible",
) {
  await page.evaluate((nextVisibilityState) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: nextVisibilityState,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("visibilitychange"));
  }, visibilityState);
}

async function waitForServiceWorkerControl(page: Page) {
  const pathname = new URL(page.url()).pathname;
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    if (pathname !== "/home") {
      await expect(page).toHaveURL(/\/home$/);
      await page.goto(pathname);
    }
  }
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

async function navigateFromMenu(
  page: Page,
  destination: string,
  expectedPathname: RegExp,
) {
  const menuButton = page.getByRole("button", { name: "Ouvrir le menu" });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole("button", { name: destination, exact: true }).click();
  await expect(page).toHaveURL(expectedPathname);
}

async function openLocalSession(page: Page) {
  await installSupabaseAuthContract(page);
  await page.goto("/home");
  const localSessionButton = page.getByRole("button", {
    name: "Continuer en session locale",
  });
  const emailInput = page.getByPlaceholder("email");

  await expect(localSessionButton.or(emailInput)).toBeVisible();

  if (await localSessionButton.isVisible()) {
    await localSessionButton.click();
  } else {
    await emailInput.fill("e2e@acrea.local");
    await page.getByPlaceholder("mot de passe").fill("e2e-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
  }

  await expect(page.getByText("Accueil", { exact: true }).last()).toBeVisible();
}

async function completeEvaluationSession(
  page: Page,
  phase: 1 | 2 | 3,
  seriesCount: number,
  maximums: number[] = [],
) {
  await expect(
    page.getByText(`Évaluation - séance ${phase}/3`, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  for (let exerciseIndex = 0; exerciseIndex < 6; exerciseIndex += 1) {
    await page.getByRole("button", { name: "Démarrer" }).click();
    await page.clock.fastForward(3_500);

    for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
      await page.getByRole("button", { name: "Série terminée" }).click();
      if (seriesIndex < seriesCount - 1) {
        await page.clock.fastForward(93_500);
      }
    }

    await page.getByRole("button", { name: "Technique validée" }).click();
    await page.getByRole("button", { name: "4", exact: true }).click();
    if (phase === 3) {
      await page
        .getByLabel("Maximum de répétitions strictes")
        .fill(String(maximums[exerciseIndex]));
    }
    await page.getByRole("button", { name: "Enregistrer et continuer" }).click();

    if (exerciseIndex < 5) {
      await expect(
        page.getByText("Récupération libre 2 à 3 min", { exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Démarrer" })).toHaveCount(0);
      await page.getByRole("button", { name: "Continuer" }).click();
    }
  }

  await expect(page.getByText("Assouplissements libres", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
}

async function configureNoEquipmentProfile(page: Page) {
  await page.goto("/profile");
  await expect(page.getByText("Réglages du programme", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complet" }).click();

  for (const fieldLabel of [
    "Sessions par semaine",
    "Durée minimum",
    "Durée maximum",
    "Nouveauté hebdomadaire (%)",
  ]) {
    await page
      .getByText(fieldLabel, { exact: true })
      .locator("..")
      .getByRole("button", { name: "Définir" })
      .click();
  }

  await page.getByRole("button", { name: "Aucun" }).click();
  await page.getByRole("button", { name: "Lun", exact: true }).click();
  await page.getByRole("button", { name: "Mer", exact: true }).click();
  await page.getByRole("button", { name: "Ven", exact: true }).click();
  await page.getByRole("button", { name: "Faible" }).click();
  await page.getByRole("button", { name: "Enregistrer le profil" }).click();
  await expect(page.getByText("Profil enregistré.", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
}

async function installSupabaseAuthContract(page: Page) {
  await page.addInitScript(() => {
    window.__ACREA_FITNESS_ENV__ = {
      ...window.__ACREA_FITNESS_ENV__,
      EXPO_PUBLIC_SUPABASE_URL: "https://e2e.supabase.co",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
    };
  });
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.route("**/auth/v1/token**", async (route) => {
    const now = Math.floor(Date.now() / 1_000);
    const user = {
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date(now * 1_000).toISOString(),
      email: "e2e@acrea.local",
      id: "00000000-0000-4000-8000-000000000001",
      identities: [],
      role: "authenticated",
      updated_at: new Date(now * 1_000).toISOString(),
      user_metadata: { name: "E2E" },
    };
    await route.fulfill({
      body: JSON.stringify({
        access_token: unsignedJwt({
          aud: "authenticated",
          email: user.email,
          exp: now + 3_600,
          sub: user.id,
        }),
        expires_at: now + 3_600,
        expires_in: 3_600,
        refresh_token: "e2e-refresh-token",
        token_type: "bearer",
        user,
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/rest/v1/user_profiles**", (route) =>
    route.fulfill({
      body: "[]",
      contentType: "application/json",
      headers: { "Content-Range": "*/0" },
      status: 200,
    }),
  );
  await page.route("**/rest/v1/acrea_profiles**", (route) =>
    route.fulfill({
      body: "[]",
      contentType: "application/json",
      headers: { "Content-Range": "*/0" },
      status: route.request().method() === "POST" ? 201 : 200,
    }),
  );
  await page.route("**/auth/v1/logout**", (route) =>
    route.fulfill({ body: "", status: 204 }),
  );
}

function unsignedJwt(payload: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}
