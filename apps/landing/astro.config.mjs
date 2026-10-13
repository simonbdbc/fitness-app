import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_SITE_ORIGIN ?? "https://acrea-fitness.fr",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  build: {
    inlineStylesheets: "always",
  },
});
