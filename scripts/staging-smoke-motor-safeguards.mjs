/**
 * Smoke tests pre-staging para PR motor safeguards (sin Supabase remoto).
 * Ejecuta: suite adversarial + validación migración lock en PGLite.
 */
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log('=== Smoke: adversarial tests ===')
run('npm', ['run', 'test:adversarial'])

console.log('=== Smoke: migración lock (PGLite) ===')
run('node', ['scripts/validate-migration-pe2-weeks-lock-pglite.mjs'])

console.log('=== Smoke OK ===')
