module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist",
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        throttlingMethod: "simulate",
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 2,
          disabled: false,
        },
        chromeFlags: "--headless --no-sandbox --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "categories:performance": [
          "error",
          { minScore: 1, aggregationMethod: "pessimistic" },
        ],
        "categories:accessibility": [
          "error",
          { minScore: 1, aggregationMethod: "pessimistic" },
        ],
        "categories:best-practices": [
          "error",
          { minScore: 1, aggregationMethod: "pessimistic" },
        ],
        "categories:seo": [
          "error",
          { minScore: 1, aggregationMethod: "pessimistic" },
        ],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouse-results/mobile",
    },
  },
};
