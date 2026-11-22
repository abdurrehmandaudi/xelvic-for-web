"use strict";

/**
 * The little server that sits between the packaged window and the network.
 *
 * The web client normally talks to its API through the Vite dev proxy (see
 * `vite.config.ts`) so every request stays same-origin. A packaged app has no
 * Vite, and the live API only answers CORS for `https://web.xelvic.com`, so
 * this module recreates the same three proxies — `/api`, `/media`, `/ws` and
 * the CDN path — and serves the built `dist/` beside them. The window loads
 * `http://127.0.0.1:PORT`, so the app sees one origin and no CORS is involved.
 */

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".mp3", "audio/mpeg"],
  [".m4a", "audio/mp4"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".wasm", "application/wasm"],
]);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const MAX_REDIRECTS = 5;

function isRedirect(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function targetOrigin(base) {
  const url = new URL(base);
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    host: url.host,
  };
}

function moduleFor(protocol) {
  return protocol === "https:" || protocol === "wss:" ? https : http;
}

/**
 * Where a request goes. `/__xelvic_cdn` is stripped, like the Vite proxy does;
 * everything else keeps its path and query.
 */
function resolveTarget(reqUrl, apiTarget, cdnTarget, wsTarget) {
  const url = new URL(reqUrl, "http://127.0.0.1");
  const pathname = url.pathname;

  if (pathname === "/__xelvic_cdn" || pathname.startsWith("/__xelvic_cdn/")) {
    return { base: cdnTarget, path: pathname.replace(/^\/__xelvic_cdn/, "") + url.search };
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return { base: apiTarget, path: reqUrl };
  }
  if (pathname === "/media" || pathname.startsWith("/media/")) {
    return { base: apiTarget, path: reqUrl };
  }
  if (pathname === "/ws" || pathname.startsWith("/ws/")) {
    return { base: wsTarget, path: reqUrl };
  }
  return null;
}

function requestHeaders(req, target) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      headers[key] = value;
    }
  }
  headers.host = target.host;
  // Mimic the origin the API's CORS policy recognises, so any origin-based
  // server-side rule sees the same trusted client the deployed web uses.
  headers.origin = "https://web.xelvic.com";
  headers.referer = "https://web.xelvic.com/";
  return headers;
}

function forward(req, res, base, targetPath, redirectsLeft = MAX_REDIRECTS, overrideHeaders = null) {
  const target = new URL(base);
  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: req.method,
    path: targetPath,
    headers: overrideHeaders || requestHeaders(req, targetOrigin(base)),
    rejectUnauthorized: true,
  };

  const upstream = moduleFor(target.protocol).request(options, (up) => {
    const status = up.statusCode || 502;
    const location = up.headers.location;

    // Follow storage/media redirects here instead of in the page: a browser
    // following them directly hits CDN CORS rules (see `vite.config.ts`).
    if (isRedirect(status) && location && redirectsLeft > 0) {
      up.resume();
      const next = new URL(location, `${target.protocol}//${target.host}${targetPath}`);

      // The API redirects private files to a signed storage address. A
      // browser drops the credential headers when a redirect crosses
      // origins, and the storage service needs that: a stray `Authorization:
      // Bearer` makes it read the request as its own SigV4 and answer
      // "Missing x-amz-content-sha256". Keep the account's headers only while
      // the redirect stays on the API's own origin.
      const nextHeaders = requestHeaders(req, targetOrigin(next.origin));
      if (next.origin !== target.origin) {
        delete nextHeaders.authorization;
        delete nextHeaders.cookie;
        delete nextHeaders.origin;
        delete nextHeaders.referer;
      }

      forward(req, res, next.origin, next.pathname + next.search, redirectsLeft - 1, nextHeaders);
      return;
    }

    const headers = {};
    for (const [key, value] of Object.entries(up.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase())) headers[key] = value;
    }
    res.writeHead(status, headers);
    up.pipe(res);
  });

  upstream.on("error", (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end(`The server could not be reached.\n${error.message}`);
    } else {
      res.destroy();
    }
  });

  // A 3xx answer can arrive before a GET body has been sent; there is none.
  req.pipe(upstream);
}

function upgrade(req, socket, head, wsTarget) {
  const target = new URL(wsTarget);
  const secure = target.protocol === "wss:" || target.protocol === "https:";
  const targetUrl = new URL(req.url, `${secure ? "https" : "http"}://${target.host}`);

  // `https.request` only accepts "https:" in `protocol`; the ws/wss scheme is
  // the caller's vocabulary, not Node's, so it is left off entirely.
  const options = {
    hostname: target.hostname,
    port: target.port || (secure ? "443" : "80"),
    method: "GET",
    path: targetUrl.pathname + targetUrl.search,
    headers: requestHeaders(req, targetOrigin(wsTarget)),
    rejectUnauthorized: true,
  };

  options.headers.upgrade = "websocket";
  options.headers.connection = "Upgrade";
  options.headers["sec-websocket-version"] = req.headers["sec-websocket-version"] || "13";
  if (req.headers["sec-websocket-key"]) {
    options.headers["sec-websocket-key"] = req.headers["sec-websocket-key"];
  }
  if (req.headers["sec-websocket-extensions"]) {
    options.headers["sec-websocket-extensions"] = req.headers["sec-websocket-extensions"];
  } else {
    delete options.headers["sec-websocket-extensions"];
  }
  if (req.headers["sec-websocket-protocol"]) {
    options.headers["sec-websocket-protocol"] = req.headers["sec-websocket-protocol"];
  } else {
    delete options.headers["sec-websocket-protocol"];
  }

  let upstream;
  try {
    upstream = (secure ? https : http).request(options);
  } catch (error) {
    socket.destroy();
    return;
  }

  upstream.on("upgrade", (up, upSocket, upHead) => {
    const lines = [`HTTP/1.1 101 Switching Protocols`];
    for (const [key, value] of Object.entries(up.headers)) {
      lines.push(`${key}: ${value}`);
    }
    socket.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (upHead && upHead.length) socket.write(upHead);
    if (head && head.length) upSocket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
    const close = () => {
      upSocket.destroy();
      socket.destroy();
    };
    upSocket.on("error", close);
    socket.on("error", close);
  });

  upstream.on("response", (up) => {
    socket.write(`HTTP/1.1 ${up.statusCode} ${up.statusMessage || ""}\r\n\r\n`);
    socket.destroy();
    up.resume();
  });

  upstream.on("error", () => socket.destroy());
  upstream.end();
}

function contentType(file) {
  return MIME.get(path.extname(file).toLowerCase()) || "application/octet-stream";
}

async function sendFile(res, file, { head = false } = {}) {
  const stat = await fsp.stat(file);
  const headers = {
    "content-type": contentType(file),
    "content-length": stat.size,
    "cache-control": file.endsWith("index.html")
      ? "no-store"
      : "public, max-age=31536000, immutable",
  };
  res.writeHead(200, headers);
  if (head) {
    res.end();
    return;
  }
  fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
}

async function serveStatic(req, res, distDir, reqUrl) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end();
    return;
  }

  const url = new URL(reqUrl, "http://127.0.0.1");
  const root = path.resolve(distDir);
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.resolve(root, `.${relative}`);

  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  let stat = await fsp.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) {
    // Client-side routes are not files; hand them to the router's index.
    if (path.extname(relative)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const index = path.join(root, "index.html");
    const indexStat = await fsp.stat(index).catch(() => null);
    if (!indexStat) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("The app was built without a dist/ directory.");
      return;
    }
    await sendFile(res, index, { head: req.method === "HEAD" });
    return;
  }

  await sendFile(res, file, { head: req.method === "HEAD" });
}

function createServer({
  distDir,
  apiTarget = "https://api.xelvic.com",
  wsTarget = "wss://api.xelvic.com",
  cdnTarget = "https://cdn.xelvic.com",
  port = 47831,
  host = "127.0.0.1",
}) {
  const server = http.createServer((req, res) => {
    try {
      const target = resolveTarget(req.url, apiTarget, cdnTarget, wsTarget);
      if (target) {
        forward(req, res, target.base, target.path);
        return;
      }
      serveStatic(req, res, distDir, req.url).catch((error) => {
        if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end(`The app could not be read.\n${error.message}`);
      });
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`The request could not be handled.\n${error.message}`);
    }
  });

  server.on("upgrade", (req, socket, head) => {
    try {
      const target = resolveTarget(req.url, apiTarget, cdnTarget, wsTarget);
      if (target && (target.base === wsTarget || req.url.startsWith("/ws"))) {
        upgrade(req, socket, head, target.base);
        return;
      }
      socket.destroy();
    } catch {
      socket.destroy();
    }
  });

  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve(server);
    });
  });
}

module.exports = { createServer };

// `node electron/proxy.cjs` in the project root is a quick way to exercise the
// packaged server in a browser without opening Electron.
if (require.main === module) {
  const distDir = path.resolve(process.argv[2] || "dist");
  const port = Number(process.env.XELVIC_DESKTOP_PORT || 47831);
  createServer({ distDir, port })
    .then(() => console.log(`proxy+static on http://127.0.0.1:${port} from ${distDir}`))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
