import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distRoot = path.join(projectRoot, "dist");
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4_173);
const mimeTypeByExtension = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
};
const pagesHeaders = await readPagesHeaders();

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const file = await resolvePublicFile(pathname);
    const body = await fs.readFile(file);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type":
        mimeTypeByExtension[path.extname(file)] ?? "application/octet-stream",
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
      ...pagesHeaders,
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`ACREA dist server listening on http://${host}:${port}\n`);
});

async function readPagesHeaders() {
  const source = await fs.readFile(path.join(distRoot, "_headers"), "utf8");
  const rootRule = source.match(/^\/\*\n([\s\S]*?)(?:\n\s*\n|$)/);
  if (!rootRule) {
    throw new Error("Cloudflare Pages root header rule is missing.");
  }

  return Object.fromEntries(
    rootRule[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator <= 0) {
          throw new Error(`Invalid Cloudflare Pages header: ${line}`);
        }
        return [line.slice(0, separator), line.slice(separator + 1).trim()];
      }),
  );
}

async function resolvePublicFile(pathname) {
  const normalizedPath = pathname.replace(/^\/+/, "");
  const candidates = [
    normalizedPath,
    `${normalizedPath}.html`,
    path.join(normalizedPath, "index.html"),
    "index.html",
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(distRoot, candidate);
    if (!resolved.startsWith(`${distRoot}${path.sep}`) && resolved !== distRoot) {
      continue;
    }

    try {
      const stat = await fs.stat(resolved);
      if (stat.isFile()) return resolved;
    } catch {
      // Try the next public candidate; unresolved routes fall back to index.
    }
  }

  throw new Error("Public file not found.");
}
