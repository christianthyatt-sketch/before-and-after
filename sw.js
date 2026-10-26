// Caches the app so it keeps working with no signal.
// Bump VERSION whenever you change a file so phones pick up the update.
const VERSION = "ba-v4";
const FILES = ["./", "index.html", "style.css", "app.js", "data.js", "more-phrases.js", "topics-1.js", "topics-2.js", "topics-3.js", "topics-4.js", "topics-5.js", "topics-6.js", "alt-clues.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      // Keep a copy of fonts and anything else fetched, for next time offline.
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("index.html")))
  );
});
