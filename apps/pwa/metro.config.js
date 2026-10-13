const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts || []), "wasm"]),
);

const enhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    const enhancedMiddleware = enhanceMiddleware
      ? enhanceMiddleware(middleware, server)
      : middleware;

    return (request, response, next) => {
      response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      return enhancedMiddleware(request, response, next);
    };
  },
};

const cssInteropRoot = path.dirname(
  require.resolve("react-native-css-interop/package.json"),
);
const workspaceRoot = path.resolve(__dirname, "../..");
const cssInteropCache = path.join(cssInteropRoot, ".cache");
const cssInteropWebCss = path.join(cssInteropCache, "web.css");

fs.mkdirSync(cssInteropCache, { recursive: true });
if (!fs.existsSync(cssInteropWebCss)) {
  fs.writeFileSync(cssInteropWebCss, "");
}

config.watchFolders = Array.from(
  new Set([
    ...(config.watchFolders || []),
    workspaceRoot,
    cssInteropRoot,
    cssInteropCache,
  ]),
);

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
