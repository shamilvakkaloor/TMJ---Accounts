// A deliberately plain static server: no SPA rewrites, as on GitHub Pages.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
const root = resolve("dist");
const prefix = "/mahal-pages-test/";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    if (!pathname.startsWith(prefix)) throw new Error("Not found");
    const relative = pathname.slice(prefix.length) || "index.html";
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) throw new Error("Not found");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4174, "127.0.0.1", () =>
  console.log("Pages test server: http://127.0.0.1:4174/mahal-pages-test/"),
);
