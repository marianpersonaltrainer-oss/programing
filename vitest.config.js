import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/** Vitest sin nodePolyfills (evita conflictos ESM en tests de utilidades). */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
