import { siteConfig } from "../config/site.config";

export function GET() {
  const sitemap = siteConfig.baseUrl
    ? `\nSitemap: ${new URL("/sitemap.xml", siteConfig.baseUrl).toString()}`
    : "";

  return new Response(`User-agent: *\nAllow: /${sitemap}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
