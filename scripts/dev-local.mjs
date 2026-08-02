#!/usr/bin/env node
/**
 * Arranque local unificado: Vite (5173) + APIs Vercel (3000).
 * Un solo puerto para Marian: http://127.0.0.1:5173
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB_PORT = 5173
const API_PORT = 3000

function waitForServer(port, { timeoutMs = 120000 } = {}) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timeout esperando API en puerto ${port}`))
        return
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) })
        if (res.ok || res.status === 404 || res.status === 401 || res.status === 405) {
          resolve()
          return
        }
      } catch {
        // API aún no lista
      }
      setTimeout(tick, 500)
    }
    tick()
  })
}

function spawnNpm(script, extraArgs = []) {
  return spawn('npm', ['run', script, ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  })
}

function killPort(port) {
  return new Promise((resolve) => {
    const killer = spawn('bash', ['-lc', `lsof -tiTCP:${port} -sTCP:LISTEN | xargs kill -9 2>/dev/null || true`], {
      stdio: 'ignore',
    })
    killer.on('close', () => resolve())
  })
}

console.log('')
console.log('══════════════════════════════════════════════════════════')
console.log('  ProgramingEvo — entorno local (web + APIs)')
console.log('══════════════════════════════════════════════════════════')
console.log('')
console.log('  Abre en Safari o Chrome (NO el navegador de Cursor):')
console.log('')
console.log('    Programador + generar semana:  http://127.0.0.1:5173/')
console.log('    Login V2:                      http://127.0.0.1:5173/?v2')
console.log('')
console.log('  Para parar: Ctrl+C en esta terminal')
console.log('══════════════════════════════════════════════════════════')
console.log('')

await killPort(WEB_PORT)
await killPort(API_PORT)
await killPort(5174)

const api = spawnNpm('dev:api')
let web = null

api.on('exit', (code) => {
  if (web) web.kill('SIGTERM')
  process.exit(code ?? 1)
})

process.on('SIGINT', () => {
  web?.kill('SIGTERM')
  api.kill('SIGTERM')
  process.exit(0)
})
process.on('SIGTERM', () => {
  web?.kill('SIGTERM')
  api.kill('SIGTERM')
  process.exit(0)
})

try {
  await waitForServer(API_PORT)
} catch {
  console.error('No arrancó la API en el puerto 3000. Revisa .env.local y ANTHROPIC_API_KEY.')
  api.kill('SIGTERM')
  process.exit(1)
}

web = spawnNpm('dev:web')
web.on('exit', (code) => {
  api.kill('SIGTERM')
  process.exit(code ?? 1)
})
