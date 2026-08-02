/* ProgramingEvo — service worker LÁPIDA (se desinstala solo).
 *
 * El service worker anterior provocaba recargas encadenadas tras cada despliegue
 * (junto con ensureFreshBuild() y el cargador diferido de vite.config.js), lo que
 * producía la sensación de "dos versiones solapadas".
 *
 * La app ya no registra ningún service worker. Pero los navegadores que abrieron la
 * web antes de este cambio SIGUEN teniendo el antiguo instalado, y borrar este archivo
 * no lo desinstala. Por eso este fichero debe seguir existiendo: cuando el navegador
 * compruebe si hay versión nueva recibirá este código, que se desinstala a sí mismo,
 * borra las cachés y recarga las pestañas abiertas una única vez.
 *
 * Se puede borrar este archivo cuando todos los dispositivos del equipo hayan abierto
 * la app al menos una vez tras el despliegue (orientativo: un par de meses).
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys()
        await Promise.all(names.map((name) => caches.delete(name)))
      } catch {
        /* Cache API no disponible */
      }

      await self.registration.unregister()

      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.navigate(client.url)
      }
    })(),
  )
})
