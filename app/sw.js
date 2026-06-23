// Bei jedem Deploy mit Code-Änderung hochzählen, um alte Caches zu invalidieren.
var CACHE_NAME = "hpp-v2";
var SHELL = [
  "/", "/index.html", "/styles.css",
  "/data.js", "/logic.js", "/srs.js", "/entitlement.js", "/app.js",
  "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // fremde Origins: normal
  if (url.pathname.startsWith("/api/")) return;     // API: immer Netz, nie Cache
  if (url.pathname === "/data.js") {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { return c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { return c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        if (req.mode === "navigate") return caches.match("/");
        return Response.error();
      });
    })
  );
});
