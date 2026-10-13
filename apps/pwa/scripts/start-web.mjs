import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const publicPort = parsePort(readArgument("--port") ?? process.env.PORT, 8_081);
const metroPort = parsePort(process.env.EXPO_METRO_PORT, publicPort + 1);
const listenHost = process.env.HOST?.trim() || "0.0.0.0";

if (publicPort === metroPort) {
  throw new Error("PORT et EXPO_METRO_PORT doivent etre differents.");
}

const isolationHeaders = {
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
};
const packageManagerCommand =
  process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const metroProcess = spawn(
  packageManagerCommand,
  ["exec", "expo", "start", "--web", "--port", String(metroPort)],
  {
    env: process.env,
    stdio: "inherit",
  },
);

const proxy = http.createServer((request, response) => {
  const upstreamRequest = http.request(
    {
      headers: request.headers,
      hostname: "127.0.0.1",
      method: request.method,
      path: request.url,
      port: metroPort,
    },
    (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders["cross-origin-embedder-policy"];
      delete responseHeaders["cross-origin-opener-policy"];
      response.writeHead(upstreamResponse.statusCode ?? 502, {
        ...responseHeaders,
        ...isolationHeaders,
      });
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(503, {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "1",
        ...isolationHeaders,
      });
    }
    response.end("Metro demarre. Recharge la page dans un instant.");
  });
  request.pipe(upstreamRequest);
});

proxy.on("upgrade", (request, socket, head) => {
  const upstreamSocket = net.connect(metroPort, "127.0.0.1", () => {
    upstreamSocket.write(serializeUpgradeRequest(request));
    if (head.length > 0) upstreamSocket.write(head);
    socket.pipe(upstreamSocket).pipe(socket);
  });

  upstreamSocket.on("error", () => socket.destroy());
  socket.on("error", () => upstreamSocket.destroy());
});

proxy.on("error", (error) => {
  console.error(`[web-dev-proxy] ${error.message}`);
  shutdown("SIGTERM", 1);
});

proxy.listen(publicPort, listenHost, () => {
  process.stdout.write(
    `ACREA web dev server listening on http://localhost:${publicPort} ` +
      `(Metro ${metroPort})\n`,
  );
});

metroProcess.on("exit", (code, signal) => {
  if (shuttingDown) return;
  const exitCode = code ?? (signal ? 1 : 0);
  shutdown("SIGTERM", exitCode);
});
metroProcess.on("error", (error) => {
  console.error(`[web-dev-metro] ${error.message}`);
  shutdown("SIGTERM", 1);
});

let shuttingDown = false;
process.on("SIGINT", () => shutdown("SIGINT", 0));
process.on("SIGTERM", () => shutdown("SIGTERM", 0));

function shutdown(signal, exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (metroProcess.exitCode === null && metroProcess.signalCode === null) {
    metroProcess.kill(signal);
  }
  proxy.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode), 1_000).unref();
}

function serializeUpgradeRequest(request) {
  const lines = [
    `${request.method ?? "GET"} ${request.url ?? "/"} HTTP/${request.httpVersion}`,
  ];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    lines.push(`${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`);
  }
  return `${lines.join("\r\n")}\r\n\r\n`;
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parsePort(value, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Port invalide: ${String(value)}`);
  }
  return port;
}
