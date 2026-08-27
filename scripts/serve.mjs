// Tiny local-only preview server for Next.js' static export. Not used by Vercel.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const config = JSON.parse(
  await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
);
const securityHeaders = Object.fromEntries(
  config.headers[0].headers.map(({ key, value }) => [key, value]),
);

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end();
    return;
  }
  let resource;
  try {
    resource = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (resource.includes("\\") || resource.includes("\0")) {
    response.writeHead(400);
    response.end();
    return;
  }
  const target = path.resolve(root, `.${resource}`);
  if (
    target !== path.resolve(root) &&
    !target.startsWith(`${path.resolve(root)}${path.sep}`)
  ) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    let file = target;
    try {
      if ((await stat(file)).isDirectory())
        file = path.join(file, "index.html");
    } catch {
      if (!path.extname(file)) file += ".html";
    }
    const content = await readFile(file);
    response.writeHead(200, {
      ...securityHeaders,
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      ...(resource === "/sw.js" ? { "Service-Worker-Allowed": "/" } : {}),
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, {
      ...securityHeaders,
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(
      request.method === "HEAD"
        ? undefined
        : await readFile(path.join(root, "404.html")).catch(() => "Not found"),
    );
  }
});

server.listen(3026, "127.0.0.1", () =>
  console.log("謝罪AI preview: http://127.0.0.1:3026"),
);
