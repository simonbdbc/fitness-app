import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const landingOrigin = stripTrailingSlash(
  process.env.PUBLIC_SITE_ORIGIN ?? "https://acrea-fitness.fr",
);
const appOrigin = stripTrailingSlash(
  process.env.PUBLIC_APP_ORIGIN ?? "https://app.acrea-fitness.fr",
);
const expectedTitle =
  "ACREA Fitness | Programme personnalisé au poids du corps";
const landingUrl = `${landingOrigin}/`;
const appHomeUrl = `${appOrigin}/home`;
const appLoginUrl = `${appOrigin}/login`;
const socialImageUrl = `${landingOrigin}/social/acrea-fitness-og.webp`;
const legalPages = [
  {
    path: "/mentions-legales/",
    title: "Mentions légales | ACREA Fitness",
  },
  {
    path: "/politique-de-confidentialite/",
    title: "Politique de confidentialité | ACREA Fitness",
  },
  {
    path: "/conditions-generales-utilisation/",
    title: "Conditions générales d'utilisation | ACREA Fitness",
  },
  {
    path: "/cookies/",
    title: "Cookies et traceurs | ACREA Fitness",
  },
];

const indexHtml = await readFile(path.join(distDir, "index.html"), "utf8");
const robots = await readFile(path.join(distDir, "robots.txt"), "utf8");
const sitemap = await readFile(path.join(distDir, "sitemap.xml"), "utf8");
const headers = await readFile(path.join(distDir, "_headers"), "utf8");

assertIncludes(indexHtml, `<title>${expectedTitle}</title>`, "document title");
assertIncludes(indexHtml, `rel="canonical" href="${landingUrl}"`, "canonical");
assertMeta(indexHtml, "name", "robots", "index, follow, max-image-preview:large");
assertMeta(indexHtml, "property", "og:url", landingUrl);
assertMeta(indexHtml, "property", "og:image", socialImageUrl);
assertMeta(indexHtml, "property", "og:image:width", "1200");
assertMeta(indexHtml, "property", "og:image:height", "630");
assertMeta(indexHtml, "name", "twitter:card", "summary_large_image");
assertMeta(indexHtml, "name", "twitter:image", socialImageUrl);

const h1Count = (indexHtml.match(/<h1\b/gi) ?? []).length;
if (h1Count !== 1) {
  throw new Error(`Landing validation failed: expected one H1, found ${h1Count}`);
}

const anchors = extractTags(indexHtml, "a");
assertCta(anchors, "primary", appLoginUrl);
assertCta(anchors, "secondary", appHomeUrl);
assertCta(anchors, "login", appLoginUrl);
assertCta(anchors, "mobile-login", appLoginUrl);
assertCta(anchors, "final", appLoginUrl);
validateAnchorDestinations(indexHtml, anchors);
assertIncludes(
  indexHtml,
  "© 2026 ACREA-FITNESS. Tous droits réservés.",
  "copyright notice",
);

const jsonLdMatch = indexHtml.match(
  /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
);
if (!jsonLdMatch) {
  throw new Error("Landing validation failed: JSON-LD is missing");
}

const jsonLd = JSON.parse(jsonLdMatch[1]);
const graphTypes = new Set(
  (jsonLd["@graph"] ?? []).map((entry) => entry["@type"]),
);
for (const type of ["WebSite", "SoftwareApplication"]) {
  if (!graphTypes.has(type)) {
    throw new Error(`Landing validation failed: JSON-LD ${type} is missing`);
  }
}

if (/<script\b(?![^>]*type="application\/ld\+json")/i.test(indexHtml)) {
  throw new Error("Landing validation failed: unexpected application script found");
}

for (const expectedHeader of [
  "Content-Security-Policy:",
  "default-src 'self'",
  "script-src 'self'",
  "Permissions-Policy:",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Strict-Transport-Security: max-age=31536000",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
]) {
  if (!headers.includes(expectedHeader)) {
    throw new Error(
      `Landing validation failed: _headers is missing ${expectedHeader}`,
    );
  }
}

if (headers.includes("Content-Security-Policy-Report-Only")) {
  throw new Error(
    "Landing validation failed: Content-Security-Policy must be enforced",
  );
}

assertIncludes(robots, "User-agent: *", "robots user agent");
assertIncludes(robots, "Allow: /", "robots allow rule");
assertIncludes(robots, `Sitemap: ${landingOrigin}/sitemap.xml`, "robots sitemap");
assertIncludes(sitemap, `<loc>${landingUrl}</loc>`, "sitemap location");

for (const page of legalPages) {
  const pageUrl = new URL(page.path, landingOrigin).toString();
  const pageHtml = await readFile(
    path.join(distDir, page.path, "index.html"),
    "utf8",
  );
  assertTitle(pageHtml, page.title, `${page.path} title`);
  assertIncludes(
    pageHtml,
    `rel="canonical" href="${pageUrl}"`,
    `${page.path} canonical`,
  );
  assertMeta(
    pageHtml,
    "name",
    "robots",
    "index, follow, max-image-preview:large",
  );
  if ((pageHtml.match(/<h1\b/gi) ?? []).length !== 1) {
    throw new Error(`Landing validation failed: ${page.path} must contain one H1`);
  }
  for (const legalPage of legalPages) {
    assertIncludes(
      pageHtml,
      `href="${legalPage.path}"`,
      `${page.path} legal navigation to ${legalPage.path}`,
    );
  }
  for (const anchor of [
    "methode",
    "acrea",
    "fonctionnalites",
    "intelligence",
    "application",
  ]) {
    assertIncludes(
      pageHtml,
      `href="/#${anchor}"`,
      `${page.path} homepage anchor ${anchor}`,
    );
  }
  assertIncludes(sitemap, `<loc>${pageUrl}</loc>`, `${page.path} sitemap location`);
}

if (process.env.PUBLIC_LEGAL_PUBLICATION_ENFORCED === "true") {
  const legalHtml = await Promise.all(
    legalPages.map((page) =>
      readFile(path.join(distDir, page.path, "index.html"), "utf8"),
    ),
  );
  if (legalHtml.some((html) => html.includes("À renseigner avant publication en production"))) {
    throw new Error(
      "Landing validation failed: production legal publication data is incomplete",
    );
  }
}

for (const relativePath of [
  "icons/favicon-32.png",
  "icons/acrea-icon-64.png",
  "icons/acrea-icon-192.png",
  "icons/apple-touch-icon.png",
  "images/hero-push-up-640.avif",
  "images/hero-push-up-1024.avif",
  "images/hero-push-up-1600.avif",
  "images/final-plank-640.avif",
  "images/final-plank-1024.avif",
  "images/final-plank-1600.avif",
  "images/acrea-method-640.avif",
  "images/acrea-method-1024.avif",
  "images/acrea-method-1600.avif",
  "images/weekly-program-480.avif",
  "images/weekly-program-720.avif",
  "images/weekly-program-940.avif",
  "social/acrea-fitness-og.webp",
  "site.webmanifest",
]) {
  await access(path.join(distDir, relativePath));
}

await assertMaximumSize("images/hero-push-up-1600.avif", 90_000);
await assertMaximumSize("images/final-plank-1600.avif", 90_000);
await assertMaximumSize("images/acrea-method-1600.avif", 150_000);
await assertMaximumSize("images/weekly-program-940.avif", 120_000);

try {
  await access(path.join(distDir, "app-icon.png"));
  throw new Error("Landing validation failed: legacy 1024px app icon is still public");
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

for (const legacyOrigin of [
  "https://fitness.sbcenter.fr",
  "https://fitness-api.sbcenter.fr",
]) {
  if ([indexHtml, robots, sitemap].some((content) => content.includes(legacyOrigin))) {
    throw new Error(`Landing validation failed: legacy origin ${legacyOrigin}`);
  }
}

console.log("Landing SEO, links and production assets validation passed.");

function assertCta(anchorTags, name, expectedHref) {
  const anchor = anchorTags.find((tag) => tag.attributes["data-cta"] === name);
  if (!anchor) {
    throw new Error(`Landing validation failed: CTA ${name} is missing`);
  }
  if (anchor.attributes.href !== expectedHref) {
    throw new Error(
      `Landing validation failed: CTA ${name} points to ${anchor.attributes.href}, expected ${expectedHref}`,
    );
  }
}

function validateAnchorDestinations(html, anchorTags) {
  const ids = new Set(
    [...html.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]),
  );

  for (const { attributes } of anchorTags) {
    const href = attributes.href;
    if (!href) {
      throw new Error("Landing validation failed: anchor without href");
    }
    if (href.startsWith("#")) {
      if (!ids.has(href.slice(1))) {
        throw new Error(`Landing validation failed: missing anchor target ${href}`);
      }
      continue;
    }
    if (href.startsWith("/")) {
      continue;
    }
    const target = new URL(href);
    if (![landingOrigin, appOrigin].includes(target.origin)) {
      throw new Error(`Landing validation failed: unexpected link origin ${target.origin}`);
    }
  }
}

function extractTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>`, "gi"))].map(
    (match) => ({
      raw: match[0],
      attributes: Object.fromEntries(
        [...match[1].matchAll(/([:\w-]+)="([^"]*)"/g)].map((attribute) => [
          attribute[1],
          attribute[2],
        ]),
      ),
    }),
  );
}

function assertMeta(html, attribute, key, expectedContent) {
  const tags = extractTags(html, "meta");
  const meta = tags.find((tag) => tag.attributes[attribute] === key);
  if (!meta || meta.attributes.content !== expectedContent) {
    throw new Error(
      `Landing validation failed: ${key} must equal ${expectedContent}`,
    );
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Landing validation failed: ${label} is missing (${expected})`);
  }
}

function assertTitle(html, expectedTitle, label) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = match?.[1]
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
  if (title !== expectedTitle) {
    throw new Error(`Landing validation failed: ${label} is invalid (${title ?? "missing"})`);
  }
}

async function assertMaximumSize(relativePath, maximumBytes) {
  const fileStat = await stat(path.join(distDir, relativePath));
  if (fileStat.size > maximumBytes) {
    throw new Error(
      `Landing validation failed: ${relativePath} is ${fileStat.size} bytes (max ${maximumBytes})`,
    );
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/$/, "");
}
