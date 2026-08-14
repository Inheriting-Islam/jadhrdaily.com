// Jadhr service worker.
//
// A daily game is opened once, briefly, often on a bad connection — so the shell is precached and
// served cache-first. There is no server and no user data here: state lives in localStorage, so
// the worker only ever caches static files.
//
// CACHE_VERSION must change whenever the shell changes, or installed players keep the old build.
// build.mjs rewrites it from the content hash, so do not edit it by hand.
const CACHE_VERSION = "jadhr-437907c3e2";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.mjs",
  "./logic.mjs",
  "./content.mjs",
  "./manifest.webmanifest",
  "./jadhr-logo-emblem.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
];

// Screenshots are install-dialog assets, not runtime assets — the browser fetches them before the
// worker exists, so precaching them would only waste a player's data.

// Deliberately no skipWaiting(). Activating a new worker over a page that was loaded by the old
// one is the documented way to end up with v1 HTML calling v2 modules; the alternative is
// interrupting play with a forced reload. A new build therefore waits and takes over on the next
// launch — which for a once-a-day game means tomorrow, with nothing lost.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // addAll fails the whole install if any single file 404s, which would leave players with no
      // offline copy at all; cache what resolves and let the rest fall through to the network.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url)))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      // claim() only matters on a first install, where there is no previous worker to conflict
      // with: it makes the very first visit controlled, so the app works offline immediately
      // rather than from the second visit onwards.
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network first so a reload picks up a new build, but fall back to the
  // cached shell so opening the installed app offline still works. ?date= / ?root= must not
  // fragment the cache, so navigations always resolve to index.html.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true })
          .then((cached) => cached || caches.match("./"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then((cached) => {
      if (cached) {
        // Refresh in the background so the next open is current without blocking this one.
        fetch(request)
          .then((fresh) => caches.open(CACHE_VERSION).then((cache) => cache.put(request, fresh)))
          .catch(() => {});
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }));
    }),
  );
});
