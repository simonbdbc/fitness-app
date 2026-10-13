import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
for (const name of ["index.html","manifest.webmanifest","service-worker.js","offline.html","pwa-build.json","_headers","_redirects"]) assert(existsSync(`dist/${name}`), name);
const info=JSON.parse(readFileSync("dist/pwa-build.json","utf8"));
assert.equal(info.releaseChannel,"demo");
assert(!/acrea-fitness\.fr|sbcenter\.fr|supabase\.co/.test(readFileSync("dist/index.html","utf8")));
assert(readFileSync("dist/_headers","utf8").includes("Cross-Origin-Opener-Policy"));
console.log("Local demonstration PWA validated.");
