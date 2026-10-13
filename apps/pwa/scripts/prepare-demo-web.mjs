import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const distDir = path.resolve("dist");
const assetsDir = path.join(distDir, "assets");
const librarySourceDir = path.resolve("../../docs/bibliotheque");
const libraryArtifactPath = path.resolve(
  "src/features/catalog/data/exerciseLibrary.json",
);
const nestedNodeModulesDir = path.join(assetsDir, "node_modules");
const textFileExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".txt"]);
const execFileAsync = promisify(execFile);
const cachePrefix = "acrea-fitness";
const productionOrigin = "http://localhost:4173";
const defaultSupportContact = "Démonstration locale";
const defaultThemeColor = "#090d10";
const offlineCoreMediaPaths = [
  "strength/no-equipment/push-up/push-up-poster.webp",
  "strength/no-equipment/push-up/push-up-animate.webp",
  "strength/no-equipment/air-squat/air-squat-poster.webp",
  "strength/no-equipment/air-squat/air-squat-animate.webp",
  "cardio/no-equipment/burpee/burpee-poster.webp",
  "cardio/no-equipment/burpee/burpee-animate.webp",
  "cardio/no-equipment/mountain-climber/mountain-climber-poster.webp",
  "cardio/no-equipment/mountain-climber/mountain-climber-animate.webp",
  "proprioception/no-equipment/lying-leg-raise/lying-leg-raise-poster.webp",
  "proprioception/no-equipment/lying-leg-raise/lying-leg-raise-animate.webp",
  "proprioception/no-equipment/lean-planche/lean-planche-poster.webp",
  "proprioception/no-equipment/lean-planche/lean-planche-animate.webp",
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await listFiles(entryPath, files);
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function replaceInTextFiles(replacements) {
  const files = await listFiles(distDir);

  for (const file of files) {
    if (!textFileExtensions.has(path.extname(file))) {
      continue;
    }

    let content = await readFile(file, "utf8");
    let nextContent = content;

    for (const [from, to] of replacements) {
      nextContent = nextContent.split(from).join(to);
    }

    if (nextContent !== content) {
      await writeFile(file, nextContent);
    }
  }
}

async function ensureHtmlMetadata() {
  const indexPath = path.join(distDir, "index.html");
  const content = await readFile(indexPath, "utf8");
  let nextContent = content
    .replace('<html lang="en">', '<html lang="fr">')
    .replace(
      'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
      'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"',
    );
  const tags = [
    `<meta name="theme-color" content="${defaultThemeColor}" />`,
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-title" content="ACREA Fitness" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black" />',
    '<meta name="application-name" content="ACREA Fitness" />',
    '<meta name="description" content="Programme ACREA Fitness offline-first." />',
    '<link rel="canonical" href="http://localhost:4173/" />',
    '<link rel="manifest" href="/manifest.webmanifest" />',
    '<link rel="icon" type="image/png" sizes="192x192" href="/icons/app-icon-192.png" />',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
    '<script src="/install-prompt-bridge.js"></script>',
  ];
  const missingTags = tags.filter((tag) => !nextContent.includes(tag));

  if (missingTags.length > 0) {
    nextContent = nextContent.replace(
      "</head>",
      `  ${missingTags.join("\n  ")}\n</head>`,
    );
  }

  if (nextContent !== content) {
    await writeFile(indexPath, nextContent);
  }
}

async function readPackageJson() {
  return JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
}

async function readGitValue(args, fallback) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: path.resolve("."),
    });
    return stdout.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function createBuildInfo() {
  const packageJson = await readPackageJson();
  const commitSha =
    process.env.CI_COMMIT_SHA ??
    process.env.CF_PAGES_COMMIT_SHA ??
    (await readGitValue(["rev-parse", "HEAD"], "local"));
  const branch =
    process.env.CI_COMMIT_BRANCH ??
    process.env.CF_PAGES_BRANCH ??
    (await readGitValue(["rev-parse", "--abbrev-ref", "HEAD"], ""));
  const releaseChannel = "demo";
  const buildId =
    process.env.BUILD_ID ??
    process.env.CI_PIPELINE_ID ??
    (commitSha !== "local" ? commitSha.slice(0, 12) : `local-${Date.now()}`);
  const origin = "http://localhost:4173";

  return {
    appName: "ACREA Fitness",
    appVersion: packageJson.version,
    buildId,
    commitSha,
    releaseChannel,
    buildDate: new Date().toISOString(),
    origin,
    supportContact:
      process.env.EXPO_PUBLIC_SUPPORT_CONTACT ?? defaultSupportContact,
  };
}

function distUrl(filePath) {
  return `/${path.relative(distDir, filePath).split(path.sep).join("/")}`;
}

function isStaticAssetUrl(url) {
  return (
    url.startsWith("/_expo/static/") ||
    url.startsWith("/assets/") ||
    url.startsWith("/icons/")
  );
}

function isPrecacheUrl(url) {
  return [
    "/index.html",
    "/offline.html",
    "/manifest.webmanifest",
    "/pwa-build.json",
    "/install-prompt-bridge.js",
  ].includes(url);
}

function isOfflineCoreMediaAsset(url) {
  return offlineCoreMediaPaths.some((pathName) => {
    const sourcePath = pathName.replace(/\.webp$/u, "");
    return url.includes(`/__docs/bibliotheque/${sourcePath}.`);
  });
}

async function writePwaBuildInfo(buildInfo) {
  await writeFile(
    path.join(distDir, "pwa-build.json"),
    `${JSON.stringify(buildInfo, null, 2)}\n`,
  );
}

/**
 * Exercise media is published as a versioned Pages resource, never imported
 * by the JavaScript bundle.  The catalogue RPC uses this exact revision in
 * each media URL, making old cached sheets safe while a new release is staged.
 */
async function publishVersionedLibraryMedia() {
  const artifact = JSON.parse(await readFile(libraryArtifactPath, "utf8"));
  const revision = artifact.revision;
  if (!/^[a-f0-9]{16}$/u.test(revision ?? "")) {
    throw new Error("exerciseLibrary.json must declare a 16-character revision.");
  }
  const targetRoot = path.join(distDir, "library", revision);
  const sourceFiles = await listFiles(librarySourceDir);
  const mediaFiles = sourceFiles.filter((file) => path.extname(file) === ".webp");
  const expectedMediaCount = artifact.summary?.posters + artifact.summary?.animations;
  if (mediaFiles.length !== expectedMediaCount) {
    throw new Error(
      `Bibliothèque média incohérente : ${mediaFiles.length}/${expectedMediaCount} WebP.`,
    );
  }
  await Promise.all(
    mediaFiles.map(async (source) => {
      const target = path.join(targetRoot, path.relative(librarySourceDir, source));
      await mkdir(path.dirname(target), { recursive: true });
      await cp(source, target, { force: true });
    }),
  );
}

async function writeServiceWorker(buildInfo) {
  const files = await listFiles(distDir);
  const urls = files.map(distUrl).filter((url) => url !== "/service-worker.js");
  const assetUrls = urls.filter(isStaticAssetUrl).sort();
  const installAssetUrls = assetUrls.filter(
    (url) =>
      !url.startsWith("/assets/__docs/bibliotheque/") ||
      isOfflineCoreMediaAsset(url),
  );
  const precacheUrls = Array.from(
    new Set([...urls.filter(isPrecacheUrl), "/index.html", "/offline.html"]),
  ).sort();

  await writeFile(
    path.join(distDir, "service-worker.js"),
    serviceWorkerSource(
      buildInfo,
      precacheUrls,
      assetUrls,
      installAssetUrls,
    ),
  );
}

function serviceWorkerSource(
  buildInfo,
  precacheUrls,
  assetUrls,
  installAssetUrls,
) {
  return `/* eslint-disable no-restricted-globals */
const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
const CACHE_PREFIX = ${JSON.stringify(cachePrefix)};
const SHELL_URL = "/index.html";
const OFFLINE_URL = "/offline.html";
const BUILD_INFO_URL = "/pwa-build.json";
const SHELL_CACHE = \`\${CACHE_PREFIX}-shell-v\${BUILD_INFO.appVersion}\`;
const ASSET_CACHE = \`\${CACHE_PREFIX}-assets-v\${BUILD_INFO.appVersion}-\${BUILD_INFO.buildId}\`;
const RUNTIME_CACHE = \`\${CACHE_PREFIX}-runtime-v\${BUILD_INFO.buildId}\`;
const RETAINED_ASSET_CACHE_COUNT = 2;
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};
const ASSET_URLS = ${JSON.stringify(assetUrls, null, 2)};
const INSTALL_ASSET_URLS = ${JSON.stringify(installAssetUrls, null, 2)};
const ASSET_URL_SET = new Set(ASSET_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      await shellCache.addAll(PRECACHE_URLS);
      const assetCache = await caches.open(ASSET_CACHE);
      await assetCache.addAll(INSTALL_ASSET_URLS);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const retainedAssetCaches = new Set(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(\`\${CACHE_PREFIX}-assets-\`))
          .slice(-RETAINED_ASSET_CACHE_COUNT),
      );
      retainedAssetCaches.add(ASSET_CACHE);
      const expectedCaches = new Set([
        SHELL_CACHE,
        RUNTIME_CACHE,
        ...retainedAssetCaches,
      ]);

      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(\`\${CACHE_PREFIX}-\`))
          .filter((cacheName) => !expectedCaches.has(cacheName))
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (shouldBypassCache(url)) {
    return;
  }

  if (isDocumentRequest(request)) {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (url.pathname === BUILD_INFO_URL) {
    event.respondWith(networkFirstBuildInfo(request));
    return;
  }

  if (ASSET_URL_SET.has(url.pathname) || url.pathname === OFFLINE_URL) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/library/")) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("message", (event) => {
  const message = event.data ?? {};

  if (message.type === "SKIP_WAITING") {
    event.ports?.[0]?.postMessage({
      type: "SKIP_WAITING_ACK",
      buildInfo: BUILD_INFO,
    });
    self.skipWaiting();
    return;
  }

  if (message.type === "GET_VERSION") {
    event.ports?.[0]?.postMessage({
      type: "VERSION",
      buildInfo: BUILD_INFO,
    });
    return;
  }

  if (message.type === "GET_DIAGNOSTICS") {
    event.waitUntil(
      (async () => {
        event.ports?.[0]?.postMessage({
          type: "DIAGNOSTICS",
          buildInfo: BUILD_INFO,
          caches: await caches.keys(),
        });
      })(),
    );
  }
});

function isDocumentRequest(request) {
  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  );
}

function shouldBypassCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.includes("/oidc") ||
    url.pathname.includes("/oauth")
  );
}

async function networkFirstDocument(request) {
  const shellCache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await shellCache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    return (
      (await shellCache.match(SHELL_URL)) ||
      (await shellCache.match(OFFLINE_URL)) ||
      Response.error()
    );
  }
}

async function networkFirstBuildInfo(request) {
  const shellCache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await shellCache.put(BUILD_INFO_URL, response.clone());
    }
    return response;
  } catch {
    return (await shellCache.match(BUILD_INFO_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}
`;
}

if (await exists(nestedNodeModulesDir)) {
  const files = await listFiles(nestedNodeModulesDir);
  const replacements = new Map();

  await mkdir(assetsDir, { recursive: true });

  for (const file of files) {
    const relativeFromAssets = path.relative(assetsDir, file).split(path.sep).join("/");
    const target = path.join(assetsDir, path.basename(file));
    const fromUrl = `/assets/${relativeFromAssets}`;
    const toUrl = `/assets/${path.basename(file)}`;

    await cp(file, target, { errorOnExist: false, force: true });
    replacements.set(fromUrl, toUrl);
  }

  await replaceInTextFiles(replacements);
  await rm(nestedNodeModulesDir, { recursive: true, force: true });
}

await ensureHtmlMetadata();
const buildInfo = await createBuildInfo();
await writePwaBuildInfo(buildInfo);
await publishVersionedLibraryMedia();
await writeServiceWorker(buildInfo);
