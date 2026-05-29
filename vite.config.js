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
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'process', 'events'],
      globals: { Buffer: true, global: true, process: true },
    }),
    react(),
  ],
  resolve: {
    alias: {
      // El campo "browser" de ExcelJS apunta a dist/exceljs.min.js (bundle UMD prefabricado) que
      // falla al parsear el workbook en navegador («reading 'sheets'»). Forzamos el build de Node,
      // que funciona con los polyfills de arriba.
      exceljs: 'exceljs/lib/exceljs.nodejs.js',
    },
  },
  optimizeDeps: {
    include: ['exceljs'],
  },
})
