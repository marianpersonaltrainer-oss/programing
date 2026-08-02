import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
