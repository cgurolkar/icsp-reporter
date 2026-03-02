// Minimal service worker for PWA installability (Chrome)
const CACHE = "icsp-pwa-v1"
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim())
})
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request))
})
