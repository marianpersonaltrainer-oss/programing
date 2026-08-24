/**
 * Arranque estándar de Vite: sin service worker y sin comprobaciones de build en cliente.
 *
 * La frescura del despliegue la garantizan las cabeceras HTTP de `vercel.json`:
 *   - index.html  -> no-cache  (el navegador siempre pide el HTML nuevo)
 *   - /assets/*   -> immutable (los nombres llevan hash, cambian en cada build)
 *
 * Historial: hubo un service worker (`public/sw.js`) más `ensureFreshBuild()` más un cargador
 * diferido en `vite.config.js`. Los tres reaccionaban a un despliegue nuevo recargando la página,
 * y encadenados provocaban recargas repetidas y mezcla de dos versiones en pantalla.
 * No volver a añadir recargas automáticas en cliente: si el HTML no se cachea, no hacen falta.
 */
const isMiCaminoPreview = /^\/mi-camino(?:\/|$)/.test(globalThis.location?.pathname || '')

if (isMiCaminoPreview) {
  // Mi Camino comparte únicamente el hosting de Preview durante el piloto. Mantiene
  // su propia entrada y estilos para no alterar Programming.
  void import('../apps/mi-camino/src/embeddedMain.jsx')
} else {
  void Promise.all([
    import('react'),
    import('react-dom/client'),
    import('./index.css'),
    import('./App.jsx'),
  ]).then(([react, reactDom, _styles, app]) => {
    reactDom.createRoot(document.getElementById('root')).render(
      react.createElement(react.StrictMode, null, react.createElement(app.default)),
    )
  })
}
