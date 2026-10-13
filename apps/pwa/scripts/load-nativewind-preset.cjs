function loadNativeWindPreset({
  load = () => require("nativewind/preset"),
  env = process.env,
} = {}) {
  try {
    return load();
  } catch (error) {
    // The Tailwind IntelliSense server can cache a missing pnpm symlink while
    // node_modules is being replaced. Keep editor completion available; real
    // Expo/Tailwind builds still fail if the NativeWind preset is unavailable.
    if ("TAILWIND_MODE" in env) {
      return {};
    }

    throw error;
  }
}

module.exports = { loadNativeWindPreset };
