import { legalPaths, siteConfig } from "../config/site.config";

export function GET() {
  const baseUrl = siteConfig.baseUrl || "https://example.com";
  const pages = ["/", ...Object.values(legalPaths)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map((page) => {
    const priority = page === "/" ? "1.0" : "0.3";
    const changefreq = page === "/" ? "weekly" : "yearly";
    return `  <url>\n    <loc>${new URL(page, baseUrl).toString()}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
