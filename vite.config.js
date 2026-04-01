import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * No importar `package.json` aquí con assert JSON: al empaquetar la config, esbuild puede resolver
 * rutas relativas tipo `../../package.json` desde este directorio; un JSON inválido fuera del repo rompe el build.
 * Versión/nombre del proyecto: duplicar en este archivo solo si hiciera falta para plugins.
 */
export default defineConfig({
  plugins: [react()],
})
