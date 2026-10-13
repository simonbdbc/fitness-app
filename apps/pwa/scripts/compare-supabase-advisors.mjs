import fs from "node:fs";

const [beforePath, afterPath] = process.argv.slice(2);

if (!beforePath || !afterPath) {
  throw new Error(
    "Usage: compare-supabase-advisors.mjs <before.json> <after.json>",
  );
}

function readAdvisors(filePath) {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(payload.results)) {
    throw new Error(`${filePath} does not contain a Supabase advisors result.`);
  }
  return payload.results;
}

const before = readAdvisors(beforePath);
const after = readAdvisors(afterPath);
const previousKeys = new Set(before.map((advisor) => advisor.cacheKey));
const newAdvisors = after.filter(
  (advisor) => !previousKeys.has(advisor.cacheKey),
);
const errors = after.filter((advisor) => advisor.level === "ERROR");

if (errors.length > 0 || newAdvisors.length > 0) {
  const failures = [
    ...new Map(
      [...errors, ...newAdvisors].map((advisor) => [advisor.cacheKey, advisor]),
    ).values(),
  ];
  for (const advisor of failures) {
    console.error(
      `[${advisor.level}] ${advisor.cacheKey}: ${advisor.detail ?? advisor.description}`,
    );
  }
  throw new Error(
    `${failures.length} blocking Supabase advisor finding(s) detected after migration.`,
  );
}

const afterKeys = new Set(after.map((advisor) => advisor.cacheKey));
const resolvedCount = before.filter(
  (advisor) => !afterKeys.has(advisor.cacheKey),
).length;
console.log(
  `Supabase advisors are stable: ${after.length} baseline warning(s), ${resolvedCount} resolved.`,
);
