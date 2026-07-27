/* ProgramingEvo — service worker mínimo para criterios de PWA (instalar / pantalla de inicio).
 * v20260727 — sube la versión al cambiar lógica para que los clientes pillen el nuevo SW. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
