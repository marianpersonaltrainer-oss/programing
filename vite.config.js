import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

function resolveBuildId() {
  const fromVercel = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim().slice(0, 7)
  if (fromVercel) return fromVercel
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

const EVO_BUILD_ID = resolveBuildId()
const EVO_BUILD_GUARD_STORAGE_KEY = 'evo_deploy_build_id'

/** Recarga antes del bundle JS si el HTML (deploy nuevo) no coincide con lo guardado en localStorage. */
function evoBuildGuardHtmlPlugin(buildId) {
  const inlineScript = `<script id="evo-build-guard">(function(){var BUILD=${JSON.stringify(buildId)};var KEY=${JSON.stringify(EVO_BUILD_GUARD_STORAGE_KEY)};try{var prev=localStorage.getItem(KEY);if(prev&&prev!==BUILD){localStorage.setItem(KEY,BUILD);var go=function(){var u=new URL(location.href);u.searchParams.set("v",BUILD);location.replace(u.toString());};if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister();}));}).then(go);return;}go();return;}if(!prev)localStorage.setItem(KEY,BUILD);}catch(e){}})();</script>`

  return {
    name: 'evo-build-guard-html',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta name="evo-build-id" content="${buildId}" />\n    ${inlineScript}`,
      )
    },
  }
}

/**
 * No importar `package.json` aquí con assert JSON: al empaquetar la config, esbuild puede resolver
 * rutas relativas tipo `../../package.json` desde este directorio; un JSON inválido fuera del repo rompe el build.
 * Versión/nombre del proyecto: duplicar en este archivo solo si hiciera falta para plugins.
 *
 * nodePolyfills: ExcelJS necesita en navegador los polyfills de Node (process/stream/buffer); sin ellos
 * `wb.xlsx.load()` falla al parsear el workbook («Cannot read properties of undefined (reading 'sheets')»).
 */
export default defineConfig({
  plugins: [
    evoBuildGuardHtmlPlugin(EVO_BUILD_ID),
    // ExcelJS en navegador necesita process/Buffer (su carga comprueba `process.browser` para elegir
    // el parser correcto; sin ello `xlsx.load` falla con «reading 'sheets'»). Usamos el build de
    // navegador propio de ExcelJS (auto-contenido) + estos polyfills.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
    react(),
  ],
  // ExcelJS elige el parser de navegador (TextDecoder) cuando `process.browser` es true; fijarlo evita
  // el fallo «reading 'sheets'» al cargar el .xlsx en el navegador.
  define: {
    'process.browser': 'true',
    __EVO_BUILD_ID__: JSON.stringify(EVO_BUILD_ID),
  },
})
