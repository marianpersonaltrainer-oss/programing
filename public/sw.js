/* ProgramingEvo — service worker mínimo para criterios de PWA (instalar / pantalla de inicio).
 * v20260728c — recarga clientes tras deploy. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.postMessage({ type: 'EVO_SW_ACTIVATED' })
      }
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
