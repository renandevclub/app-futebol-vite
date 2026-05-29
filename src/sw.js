/*
 * Futebol Milhão — Service Worker
 *
 * Este arquivo é usado pelo vite-plugin-pwa em modo injectManifest.
 * Ele combina o SW personalizado existente com o precache do Workbox.
 */

importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.6.2/workbox-sw.js",
);
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

const CACHE_NAME = "futmilhao-v4";
const RUNTIME_CACHE = "futmilhao-runtime-v4";

const CRITICAL_ASSETS = [
  "/",
  "/index.html",
  "/pages/welcome.html",
  "/pages/dashboard.html",
  "/manifest.webmanifest",
  "/assets/images/emblema-castor.png",
];

const STATIC_CACHE_PATTERNS = [
  /\.css$/,
  /\.js$/,
  /\.woff2?$/,
  /\.(png|jpg|jpeg|gif|svg|webp|ico)$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CRITICAL_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (STATIC_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/pages/welcome.html");
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
