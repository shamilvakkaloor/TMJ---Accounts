import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url)),
  port = Number(process.argv[2] || 8000),
  base = process.argv[3] || "/";
if (!base.startsWith("/") || !base.endsWith("/"))
  throw new Error("Base path must start and end with /.");
const allowed = new Set([
  "index.html",
  "manifest.webmanifest",
  "app.js",
  "config.js",
  "assets",
  "lib",
  "domain",
  "pages",
  "vendor",
  "tests",
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".txt": "text/plain",
};
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith(base)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const relative = path.slice(base.length) || "index.html",
      file = resolve(root, relative);
    if (
      !file.startsWith(resolve(root) + sep) ||
      !allowed.has(relative.split("/")[0]) ||
      relative.split("/").some((p) => p.startsWith("."))
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    if (!(await stat(file)).isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Mahal Accounts: http://127.0.0.1:${port}${base}`),
);
