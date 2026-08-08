import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { validateDeploymentTarget } from './scripts/validate-deployment-target.mjs'

validateDeploymentTarget(process.env)

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

/**
 * Inyecta <meta name="evo-build-id"> en el HTML. Solo informativo: sirve para comprobar a simple
 * vista qué build está sirviendo Vercel. No dispara ninguna recarga.
 */
function evoBuildMetaPlugin(buildId) {
  return {
    name: 'evo-build-meta',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta name="evo-build-id" content="${buildId}" />`,
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
 *
 * NOTA DE MANTENIMIENTO — no volver a añadir "cargadores diferidos" ni comprobaciones de build en
 * cliente. Aquí vivió un plugin (`evo-deferred-app-loader`) que, antes de cargar el bundle, pedía el
 * HTML por red y recargaba con location.replace() si el build id no coincidía. Sumado al service
 * worker y a ensureFreshBuild() daba hasta tres recargas encadenadas tras cada despliegue, con la
 * apariencia de dos versiones solapadas. La frescura la resuelven las cabeceras de vercel.json:
 * index.html con no-cache y /assets/* inmutable con nombres con hash.
 */
export default defineConfig({
  plugins: [
    evoBuildMetaPlugin(EVO_BUILD_ID),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
    react(),
  ],
  define: {
    'process.browser': 'true',
    __EVO_BUILD_ID__: JSON.stringify(EVO_BUILD_ID),
  },
})
