/**
 * Verifica usuario temporal solo en staging (no modifica nada).
 */
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const STAGING_REF = 'dgkvaorzuebdloegumai'
const PROD_REF = 'wxrqvcthrkabjllvqghq'
const EMAIL = 'pe2-staging-preview@evo.test'

function loadEnvFile(name) {
  const envPath = join(root, name)
  if (!existsSync(envPath)) return {}
  const out = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[trimmed.slice(0, eq).trim()] = val
  }
  return out
}

function refFromUrl(url) {
  return url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || null
}

async function userExists(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null
}

async function main() {
  const stagingEnv = loadEnvFile('.env.staging')
  const stagingUrl = stagingEnv.SUPABASE_URL || stagingEnv.VITE_SUPABASE_URL
  const stagingKey = stagingEnv.SUPABASE_SERVICE_ROLE_KEY
  const stagingRef = refFromUrl(stagingUrl)

  console.log('staging ref:', stagingRef)
  if (stagingRef !== STAGING_REF) throw new Error('staging ref inesperado')

  const stagingAdmin = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } })
  const stagingUser = await userExists(stagingAdmin, EMAIL)
  console.log('usuario en staging:', stagingUser ? 'sí' : 'no', stagingUser?.id?.slice(0, 8) + '…')

  if (stagingUser) {
    const { data: profile } = await stagingAdmin
      .from('profiles')
      .select('role, org_id')
      .eq('id', stagingUser.id)
      .maybeSingle()
    console.log('rol staging:', profile?.role || 'sin perfil')
    console.log('org_id staging:', profile?.org_id ? 'sí' : 'no')
  }

  // Producción: solo lectura vía URL de Puente si hay service key; si no, skip seguro
  const puenteEnvPath = join('/Users/apple/Desktop/programingevo', '.env')
  let prodCheck = 'omitido (sin service role producción en entorno local)'
  if (existsSync(puenteEnvPath)) {
    const puente = loadEnvFile('/Users/apple/Desktop/programingevo/.env')
    const prodUrl = puente.VITE_SUPABASE_URL
    const prodRef = refFromUrl(prodUrl)
    if (prodRef === PROD_REF) {
      // listUsers requires service role; anon cannot list. Report ref only unless we have prod service key in env
      prodCheck = `producción ref confirmado ${PROD_REF}; listado auth requiere service role (no usado)`
    }
  }
  console.log('producción:', prodCheck)
}

main().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
