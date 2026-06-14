/* dentali. PWA service worker stub — cache shell only, network-first for navigations */

const CACHE_NAME = "dentali-shell-v3"
const SHELL = ["/", "/login", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/") ?? Response.error())
    )
    return
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached ?? fetch(event.request))
    )
  }
})
