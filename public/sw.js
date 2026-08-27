/* A small, dependency-free worker for a public, statically exported app. */
const CACHE_PREFIX = "apology-ai-";
const CACHE_VERSION = "v1";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`;
const MAX_ASSETS = 120;
const STATIC_PATHS = new Set([
  "/icon.svg",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
]);

function allowedAsset(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return false;
    if (/^\/(?:api|_vercel|vercel\/insights)(?:\/|$)/.test(url.pathname)) return false;
    return (
      (url.pathname.startsWith("/_next/static/") &&
        /\.(?:js|css|woff2?|ttf|otf|png|svg|webp|avif|ico)$/.test(url.pathname)) ||
      STATIC_PATHS.has(url.pathname)
    );
  } catch {
    return false;
  }
}

function isPublicResponse(response) {
  return response.ok && response.type !== "opaque" && !response.redirected;
}

async function trimAssetCache(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)));
}

async function cacheAsset(value) {
  if (!allowedAsset(value)) return;
  const url = new URL(value, self.location.origin);
  const cache = await caches.open(ASSET_CACHE);
  if (await cache.match(url.href)) return;
  const response = await fetch(url.href, { cache: "reload" });
  if (!isPublicResponse(response)) return;
  const css = url.pathname.endsWith(".css") ? await response.clone().text() : null;
  await cache.put(url.href, response);
  if (css) {
    const dependencies = [...css.matchAll(/url\(\s*["']?([^"'\s)]+)["']?\s*\)/g)]
      .map((match) => new URL(match[1], url.href).href)
      .filter(allowedAsset);
    await Promise.allSettled(dependencies.map(cacheAsset));
  }
}

async function warmAssets(values) {
  await Promise.allSettled(values.slice(0, 100).map(cacheAsset));
  await trimAssetCache(await caches.open(ASSET_CACHE));
}

function assetsFromHtml(html) {
  return [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"))
    .filter(allowedAsset);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const [home, offline] = await Promise.all([
      fetch("/", { cache: "reload" }),
      fetch("/offline.html", { cache: "reload" }),
    ]);
    if (!isPublicResponse(home) || !isPublicResponse(offline)) {
      throw new Error("The offline app shell could not be prepared.");
    }
    const html = await home.clone().text();
    await Promise.all([
      cache.put("/", home),
      cache.put("/offline.html", offline),
    ]);
    await warmAssets([...assetsFromHtml(html), ...STATIC_PATHS]);
    // This app has no server session or in-flight server mutations to interrupt.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== ASSET_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigationResponse(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (!isPublicResponse(response)) throw new Error("The app is temporarily unavailable.");
    if (response.headers.get("content-type")?.includes("text/html")) {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put("/", response.clone());
      } catch {
        // A full or unavailable cache must not break a successful online load.
      }
    }
    return response;
  } catch {
    try {
      const cache = await caches.open(SHELL_CACHE);
      const fallback = (await cache.match("/")) ?? (await cache.match("/offline.html"));
      if (fallback) return fallback;
    } catch {
      // A plain response also works when browser storage is unavailable.
    }
    return new Response("オフラインです。接続後にもう一度お試しください。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only the known public app page is cached. RSC, APIs, analytics, external
  // origins, non-GET requests, and user data are deliberately never cached.
  if (request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html")) {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (!allowedAsset(url.href)) return;

  event.respondWith((async () => {
    let cache;
    try {
      cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
    } catch {
      // The network remains usable when Cache Storage is blocked.
    }
    const response = await fetch(request);
    if (cache && isPublicResponse(response)) {
      try {
        await cache.put(request, response.clone());
        await trimAssetCache(cache);
      } catch {
        // Quota exhaustion is not a reason to fail an otherwise good response.
      }
    }
    return response;
  })());
});

self.addEventListener("message", (event) => {
  const source = event.source;
  if (!source || !source.url || new URL(source.url).origin !== self.location.origin) return;
  if (event.data?.type !== "CACHE_ASSETS" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((value) => typeof value === "string" && allowedAsset(value));
  event.waitUntil(warmAssets(urls).then(() => {
    source.postMessage({ type: "APOLOGY_PWA_READY" });
  }));
});
