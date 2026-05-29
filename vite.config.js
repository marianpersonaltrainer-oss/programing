import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
  },
})
