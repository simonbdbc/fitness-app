import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const lifecyclePath = path.join(
  projectRoot,
  "src/features/pwa/services/pwaLifecycle.ts",
);
const lifecycleSource = await fs.readFile(lifecyclePath, "utf8");
const compiled = ts.transpileModule(lifecycleSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: lifecyclePath,
}).outputText;
const {
  hasRemoteBuildChanged,
  resolveInstallStatus,
  shouldReloadAfterControllerChange,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const providerSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/providers/PwaProvider.tsx"),
  "utf8",
);
const appLayoutSource = await fs.readFile(
  path.join(projectRoot, "src/application/layouts/AppLayout.tsx"),
  "utf8",
);
const installationLifecycleSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/hooks/useInstallationLifecycle.ts"),
  "utf8",
);
const serviceWorkerLifecycleSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/hooks/useServiceWorkerLifecycle.ts"),
  "utf8",
);
const appLifecycleSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/hooks/useAppLifecycle.ts"),
  "utf8",
);
const sessionTimerHookSource = await fs.readFile(
  path.join(projectRoot, "src/features/workouts/hooks/useSessionTimer.ts"),
  "utf8",
);
const rootRouteSource = await fs.readFile(
  path.join(projectRoot, "app/index.tsx"),
  "utf8",
);
const protectedLayoutSource = await fs.readFile(
  path.join(projectRoot, "src/application/layouts/ProtectedAppLayout.tsx"),
  "utf8",
);
const screenShellSource = await fs.readFile(
  path.join(projectRoot, "src/shared/ui/ScreenShell.tsx"),
  "utf8",
);
const displaySessionSource = await fs.readFile(
  path.join(projectRoot, "src/shared/persistence/displaySessionPersistence.ts"),
  "utf8",
);
const authProviderSource = await fs.readFile(
  path.join(projectRoot, "src/features/auth/providers/AuthProvider.tsx"),
  "utf8",
);
const profileProviderSource = await fs.readFile(
  path.join(
    projectRoot,
    "src/features/programming/providers/ACREAProfileProvider.tsx",
  ),
  "utf8",
);
const rootHtmlSource = await fs.readFile(
  path.join(projectRoot, "app/+html.tsx"),
  "utf8",
);
const installPromptBridgeSource = await fs.readFile(
  path.join(projectRoot, "public/install-prompt-bridge.js"),
  "utf8",
);
const cloudflareBuildSource = await fs.readFile(
  path.join(projectRoot, "scripts/prepare-cloudflare-pages.mjs"),
  "utf8",
);
const browserInstallElementSource = await fs.readFile(
  path.join(
    projectRoot,
    "src/features/pwa/components/BrowserInstallElement.web.tsx",
  ),
  "utf8",
);
const installAppButtonSource = await fs.readFile(
  path.join(projectRoot, "src/features/pwa/components/InstallAppButton.tsx"),
  "utf8",
);
const packageJson = JSON.parse(
  await fs.readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const appConfig = JSON.parse(
  await fs.readFile(path.join(projectRoot, "app.json"), "utf8"),
);
const manifest = JSON.parse(
  await fs.readFile(path.join(projectRoot, "public/manifest.webmanifest"), "utf8"),
);
const webDevServerSource = await fs.readFile(
  path.join(projectRoot, "scripts/start-web.mjs"),
  "utf8",
);

test("a Chromium browser stays checking before falling back to manual install", () => {
  const input = {
    displayMode: "browser",
    hasDismissal: false,
    hasPrompt: false,
    supportsManualInstall: true,
  };

  assert.equal(
    resolveInstallStatus({ ...input, detectionComplete: false }),
    "checking",
  );
  assert.equal(
    resolveInstallStatus({ ...input, detectionComplete: true }),
    "manual",
  );
  assert.equal(
    resolveInstallStatus({
      ...input,
      detectionComplete: true,
      hasPrompt: true,
    }),
    "available",
  );
});

test("dismissal and standalone states take precedence", () => {
  assert.equal(
    resolveInstallStatus({
      detectionComplete: true,
      displayMode: "browser",
      hasDismissal: true,
      hasPrompt: true,
      supportsManualInstall: true,
    }),
    "dismissed",
  );
  assert.equal(
    resolveInstallStatus({
      detectionComplete: true,
      displayMode: "standalone",
      hasDismissal: false,
      hasPrompt: false,
      supportsManualInstall: false,
    }),
    "installed",
  );
});

test("installation browser events stay outside the provider composition", () => {
  assert.match(providerSource, /useInstallationLifecycle\(\)/);
  assert.doesNotMatch(providerSource, /beforeinstallprompt/);
  assert.match(installationLifecycleSource, /beforeinstallprompt/);
  assert.match(installationLifecycleSource, /appinstalled/);
});

test("the install prompt is captured before the React application mounts", () => {
  assert.match(rootHtmlSource, /src="\/install-prompt-bridge\.js"/);
  assert.match(cloudflareBuildSource, /src="\/install-prompt-bridge\.js"/);
  assert.match(installPromptBridgeSource, /beforeinstallprompt/);
  assert.match(installPromptBridgeSource, /event\.preventDefault\(\)/);
  assert.match(installPromptBridgeSource, /__ACREA_PWA_INSTALL_PROMPT__/);
  assert.match(installationLifecycleSource, /readCapturedInstallPrompt\(\)/);
  assert.match(installationLifecycleSource, /capturedInstallPromptEventName/);
  assert.match(providerSource, /isInstallPromptAvailable/);
  assert.match(installAppButtonSource, /isInstallPromptAvailable/);
});

test("the experimental install element keeps the Chromium fallback", () => {
  assert.match(browserInstallElementSource, /"HTMLInstallElement" in window/);
  assert.match(browserInstallElementSource, /createElement\("install"/);
  assert.match(browserInstallElementSource, /if \(!enabled \|\| !isSupported\) return children/);
  assert.match(browserInstallElementSource, /promptaction/);
  assert.match(browserInstallElementSource, /promptdismiss/);
  assert.match(browserInstallElementSource, /validationstatuschanged/);
  assert.match(installAppButtonSource, /<BrowserInstallElement/);
});

test("provider remains a composition boundary for PWA lifecycles", () => {
  assert.match(providerSource, /useConnectionHealth\(\)/);
  assert.match(providerSource, /useInstallationLifecycle\(\)/);
  assert.match(providerSource, /useServiceWorkerLifecycle\(\)/);
  assert.match(providerSource, /usePwaDiagnostics\(/);
  assert.doesNotMatch(providerSource, /navigator\.|window\.|fetch\(/);
});

test("web development stays cross-origin isolated for expo-sqlite", () => {
  assert.equal(packageJson.scripts.web, "node scripts/start-web.mjs");
  assert.match(webDevServerSource, /Cross-Origin-Embedder-Policy/);
  assert.match(webDevServerSource, /Cross-Origin-Opener-Policy/);
  assert.match(webDevServerSource, /\["exec", "expo", "start"/);
  assert.match(webDevServerSource, /proxy\.on\("upgrade"/);

  const routerPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-router",
  );
  assert.deepEqual(routerPlugin?.[1]?.headers, {
    "Cross-Origin-Embedder-Policy": "credentialless",
    "Cross-Origin-Opener-Policy": "same-origin",
  });
});

test("two different build ids expose an update", () => {
  assert.equal(hasRemoteBuildChanged("build-n", "build-n+1"), true);
  assert.equal(hasRemoteBuildChanged("build-n", "build-n"), false);
  assert.equal(hasRemoteBuildChanged(null, "build-n+1"), false);
});

test("controller change reload requires explicit consent", () => {
  assert.equal(shouldReloadAfterControllerChange(false), false);
  assert.equal(shouldReloadAfterControllerChange(true), true);
  assert.match(
    serviceWorkerLifecycleSource,
    /const acknowledged = await requestWorkerSkipWaiting\(waitingWorker\)/,
  );
  assert.doesNotMatch(
    serviceWorkerLifecycleSource,
    /setTimeout\([\s\S]{0,300}window\.location\.reload/,
  );
  assert.match(providerSource, /useServiceWorkerLifecycle\(\)/);
  assert.match(serviceWorkerLifecycleSource, /clearCurrentDisplaySession\(\)/);
  assert.match(serviceWorkerLifecycleSource, /window\.location\.replace\("\/"\)/);
  assert.match(
    appLayoutSource,
    /<InstallAppBanner \/>\s*<UpdateAvailablePrompt \/>/,
  );
});

test("phase one keeps lifecycle ownership local to timers", () => {
  assert.match(sessionTimerHookSource, /AppState\.addEventListener/);
  assert.match(sessionTimerHookSource, /document\.addEventListener\("visibilitychange"/);
  assert.doesNotMatch(sessionTimerHookSource, /appLifecycleCoordinator/);
  assert.match(appLifecycleSource, /document\.addEventListener\("visibilitychange"/);
  assert.doesNotMatch(providerSource, /foregroundRevision|isForeground/);
});

test("display state is runtime-scoped and persisted only through AsyncStorage", () => {
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.launch_handler, undefined);
  assert.doesNotMatch(rootRouteSource, /InstalledRoute|sessionStorage|launchQueue/);
  assert.match(protectedLayoutSource, /writeDisplaySessionRoute/);
  assert.match(appLayoutSource, /displaySessionStorageKey/);
  assert.match(screenShellSource, /usePersistentScrollPosition/);
  assert.match(displaySessionSource, /@react-native-async-storage\/async-storage/);
  assert.match(displaySessionSource, /acrea-fitness\.display-session\.v1/);
  assert.match(displaySessionSource, /const runtimeId = createRuntimeId\(\)/);
  assert.doesNotMatch(displaySessionSource, /Supabase|localStorage|sessionStorage/);
});

test("foreground auth refresh cannot rehydrate the mounted profile tree", () => {
  assert.match(authProviderSource, /resolveAuthSessionLifecycleAction/);
  assert.match(authProviderSource, /action === "session-only"/);
  assert.match(profileProviderSource, /const userId = user\?\.id \?\? null/);
  assert.match(profileProviderSource, /loadProfileLocalFirst/);
  assert.doesNotMatch(profileProviderSource, /\[isAuthLoading, user\]/);
});
