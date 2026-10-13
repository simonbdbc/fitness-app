import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const productionAppOrigin =
  process.env.EXPO_PUBLIC_APP_ORIGIN ??
  "https://app.acrea-fitness.fr";
const requiredProductionEnv = [
  "EXPO_PUBLIC_APP_ORIGIN",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "install-prompt-bridge.js",
  "service-worker.js",
  "offline.html",
  "pwa-build.json",
  "_headers",
  "_redirects",
  "icons/app-icon-192.png",
  "icons/app-icon-512.png",
  "icons/app-icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "screenshots/install-desktop-wide.jpg",
  "screenshots/install-mobile.jpg",
];

function fail(message) {
  throw new Error(`PWA validation failed: ${message}`);
}

async function fileExists(relativePath) {
  try {
    await stat(path.join(distDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  return readFile(path.join(distDir, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

for (const file of requiredFiles) {
  if (!(await fileExists(file))) {
    fail(`${file} is missing`);
  }
}

const indexHtml = await readText("index.html");
for (const snippet of [
  'rel="manifest"',
  'name="theme-color"',
  'name="mobile-web-app-capable"',
  'rel="apple-touch-icon"',
  'src="/install-prompt-bridge.js"',
]) {
  if (!indexHtml.includes(snippet)) {
    fail(`index.html does not include ${snippet}`);
  }
}

if (!indexHtml.includes(`rel="canonical" href="${productionAppOrigin}/"`)) {
  fail(`index.html canonical must use ${productionAppOrigin}`);
}

const manifest = await readJson("manifest.webmanifest");
for (const field of [
  "id",
  "name",
  "short_name",
  "description",
  "start_url",
  "scope",
  "display",
  "background_color",
  "theme_color",
  "icons",
]) {
  if (!manifest[field]) {
    fail(`manifest field ${field} is missing`);
  }
}

if (manifest.display !== "standalone") {
  fail("manifest display must be standalone");
}

if (manifest.prefer_related_applications !== false) {
  fail("manifest must prefer the installable web app");
}

if (manifest.lang !== "fr") {
  fail("manifest lang must be fr");
}

if (
  manifest.background_color !== "#090d10" ||
  manifest.theme_color !== "#090d10"
) {
  fail("manifest launch colors must match the default dark theme");
}

const manifestStartUrl = new URL(manifest.start_url, productionAppOrigin);
const manifestScopeUrl = new URL(manifest.scope, productionAppOrigin);
if (manifest.start_url !== "/") {
  fail("manifest start_url must be the stable, non-redirected root URL");
}
if (!manifestStartUrl.pathname.startsWith(manifestScopeUrl.pathname)) {
  fail("manifest start_url must be inside scope");
}

const iconSizes = new Set(manifest.icons.map((icon) => icon.sizes));
if (!iconSizes.has("192x192") || !iconSizes.has("512x512")) {
  fail("manifest must include 192x192 and 512x512 icons");
}

if (!manifest.icons.some((icon) => icon.purpose === "maskable")) {
  fail("manifest must include a maskable icon");
}

for (const requiredSize of ["192x192", "512x512"]) {
  if (
    !manifest.icons.some(
      (icon) => icon.sizes === requiredSize && icon.purpose === "any",
    )
  ) {
    fail(`manifest must include an any-purpose ${requiredSize} icon`);
  }
}

if (!Array.isArray(manifest.screenshots)) {
  fail("manifest screenshots are missing");
}

const wideScreenshot = manifest.screenshots.find(
  (screenshot) => screenshot.form_factor === "wide",
);
if (
  !wideScreenshot ||
  wideScreenshot.src !== "/screenshots/install-desktop-wide.jpg" ||
  wideScreenshot.sizes !== "1280x720" ||
  wideScreenshot.type !== "image/jpeg"
) {
  fail("manifest must include the desktop wide install screenshot");
}

const mobileScreenshot = manifest.screenshots.find(
  (screenshot) => screenshot.form_factor !== "wide",
);
if (
  !mobileScreenshot ||
  mobileScreenshot.src !== "/screenshots/install-mobile.jpg" ||
  mobileScreenshot.sizes !== "390x844" ||
  mobileScreenshot.type !== "image/jpeg"
) {
  fail("manifest must include the mobile install screenshot");
}

const headers = await readText("_headers");
if (!headers.includes("/service-worker.js") || !headers.includes("no-cache")) {
  fail("_headers must mark service-worker.js as no-cache");
}
if (!headers.includes("Content-Security-Policy:")) {
  fail("_headers must define an enforced Content-Security-Policy");
}
if (headers.includes("Content-Security-Policy-Report-Only")) {
  fail("_headers must not leave the Content-Security-Policy in report-only mode");
}
if (headers.includes("'unsafe-eval'")) {
  fail("_headers must not allow unsafe-eval scripts");
}
if (!headers.includes("'wasm-unsafe-eval'")) {
  fail("_headers must allow the WebAssembly SQLite runtime without unsafe-eval");
}
if (headers.includes("acrea-fitness-api.sbcenter.fr")) {
  fail("_headers must not allow the retired ACREA API origin");
}
if (!headers.includes("Cross-Origin-Embedder-Policy: credentialless")) {
  fail("_headers must enable COEP for expo-sqlite on web");
}
if (!headers.includes("Cross-Origin-Opener-Policy: same-origin")) {
  fail("_headers must enable COOP for expo-sqlite on web");
}
for (const requiredHeader of [
  "Permissions-Policy:",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Strict-Transport-Security: max-age=31536000",
  "X-Frame-Options: DENY",
]) {
  if (!headers.includes(requiredHeader)) {
    fail(`_headers must define ${requiredHeader}`);
  }
}
if (process.env.EXPO_PUBLIC_API_BASE_URL?.trim()) {
  fail("EXPO_PUBLIC_API_BASE_URL is retired; use Supabase directly instead");
}

const redirects = await readText("_redirects");
if (/^\/\S*\s+\/index\.html\s+200\s*$/m.test(redirects)) {
  fail("_redirects must rely on the Cloudflare Pages SPA fallback");
}
if (await fileExists("404.html")) {
  fail("dist must not include 404.html because it disables the Pages SPA fallback");
}

const installPromptBridge = await readText("install-prompt-bridge.js");
for (const snippet of [
  "beforeinstallprompt",
  "event.preventDefault()",
  "__ACREA_PWA_INSTALL_PROMPT__",
  "acrea:pwa-install-prompt",
]) {
  if (!installPromptBridge.includes(snippet)) {
    fail(`install prompt bridge does not include ${snippet}`);
  }
}

const serviceWorker = await readText("service-worker.js");
for (const snippet of [
  "acrea-fitness",
  "SKIP_WAITING",
  "clients.claim()",
  "networkFirstDocument",
  "cacheFirst",
  "GET_DIAGNOSTICS",
  "RETAINED_ASSET_CACHE_COUNT",
  "INSTALL_ASSET_URLS",
  "assetCache.addAll(INSTALL_ASSET_URLS)",
  "/install-prompt-bridge.js",
]) {
  if (!serviceWorker.includes(snippet)) {
    fail(`service worker does not include ${snippet}`);
  }
}

const installAssetUrlsMatch = serviceWorker.match(
  /const INSTALL_ASSET_URLS = (\[[\s\S]*?\]);/,
);
if (!installAssetUrlsMatch) {
  fail("service worker install asset list is missing");
}
const installAssetUrls = JSON.parse(installAssetUrlsMatch[1]);
if (installAssetUrls.length > 100) {
  fail(
    `service worker install asset budget exceeded: ${installAssetUrls.length}`,
  );
}
const bundledLibraryMedia = installAssetUrls.filter((url) =>
  url.startsWith("/assets/__docs/bibliotheque/"),
);
if (bundledLibraryMedia.length !== 12) {
  fail(
    `exactly the 12 offline V4 core media files must be bundled, received ${bundledLibraryMedia.length}`,
  );
}

const buildInfo = await readJson("pwa-build.json");
for (const field of [
  "appName",
  "appVersion",
  "buildId",
  "commitSha",
  "releaseChannel",
  "buildDate",
  "origin",
  "supportContact",
]) {
  if (!buildInfo[field]) {
    fail(`pwa-build field ${field} is missing`);
  }
}

if (
  buildInfo.releaseChannel === "production" &&
  buildInfo.origin !== productionAppOrigin
) {
  fail(`production pwa-build origin must be ${productionAppOrigin}`);
}

if (buildInfo.releaseChannel === "production") {
  for (const variableName of requiredProductionEnv) {
    if (!process.env[variableName]?.trim()) {
      fail(`production build environment is missing ${variableName}`);
    }
  }
}

for (const legacyOrigin of [
  "https://fitness.sbcenter.fr",
  "https://fitness-api.sbcenter.fr",
]) {
  if (
    [indexHtml, headers, serviceWorker].some((content) =>
      content.includes(legacyOrigin),
    )
  ) {
    fail(`legacy origin ${legacyOrigin} is still present`);
  }
}

console.log("PWA validation passed.");
