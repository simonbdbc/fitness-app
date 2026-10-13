/** @type {import('tailwindcss').Config} */
const { loadNativeWindPreset } = require("./scripts/load-nativewind-preset.cjs");

module.exports = {
  darkMode: "class",
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [loadNativeWindPreset()],
  theme: {
    extend: {},
  },
  plugins: [],
};
