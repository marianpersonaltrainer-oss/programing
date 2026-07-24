/**
 * Escribe .env.staging sin imprimir secretos. Uso interno del bootstrap.
 */
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const STAGING_REF = 'dgkvaorzuebdloegumai'
const PROD_REF = 'wxrqvcthrkabjllvqghq'

function loadPassword() {
  if (process.env.STAGING_DB_PASSWORD?.trim()) return process.env.STAGING_DB_PASSWORD.trim()
  const probePath = join(root, '.env.staging.password')
  if (existsSync(probePath)) return readFileSync(probePath, 'utf8').trim()
  throw new Error('Falta STAGING_DB_PASSWORD')
}

async function fetchApiKeys() {
  const r = spawnSync('npx', ['supabase', 'projects', 'api-keys', '--project-ref', STAGING_REF, '--output', 'json'], {
    cwd: root,
    encoding: 'utf8',
  })
  const raw = r.stdout || ''
  const jsonStart = raw.indexOf('[')
  if (jsonStart < 0) throw new Error('No se pudieron leer API keys de staging')
  const keys = JSON.parse(raw.slice(jsonStart))
  const anon = keys.find((k) => k.name === 'anon')?.api_key
  const service = keys.find((k) => k.name === 'service_role')?.api_key
  if (!anon) throw new Error('Falta anon key')
  return { anon, service }
}

async function main() {
  if (STAGING_REF === PROD_REF) throw new Error('Ref staging coincide con producción')

  const password = loadPassword()
  const { anon, service } = await fetchApiKeys()
  const encoded = encodeURIComponent(password)
  const url = `https://${STAGING_REF}.supabase.co`
  const dbUrl = `postgresql://postgres.${STAGING_REF}:${encoded}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`

  const content = `# Auto-generado — NO commitear. Proyecto: programing-evo-staging (${STAGING_REF})
STAGING_SUPABASE_URL=${url}
STAGING_DATABASE_URL=${dbUrl}
VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${anon}
SUPABASE_URL=${url}
SUPABASE_SERVICE_ROLE_KEY=${service}
`

  writeFileSync(join(root, '.env.staging'), content, { mode: 0o600 })
  console.log(`OK: .env.staging escrito para ref ${STAGING_REF} (≠ producción ${PROD_REF})`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
