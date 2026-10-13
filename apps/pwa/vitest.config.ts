import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromProjectRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: [
      {
        find: /^react-native-svg$/,
        replacement: fromProjectRoot(
          "./node_modules/react-native-svg/lib/module/elements.web.js",
        ),
      },
      { find: /^react-native$/, replacement: "react-native-web" },
      { find: "@application", replacement: fromProjectRoot("./src/application") },
      { find: "@features", replacement: fromProjectRoot("./src/features") },
      { find: "@shared", replacement: fromProjectRoot("./src/shared") },
    ],
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ["./tests/component/setup.ts"],
    include: ["src/**/*.component.test.{ts,tsx}"],
  },
});
