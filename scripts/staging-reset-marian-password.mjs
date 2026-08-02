/**
 * Sincroniza contraseña staging → archivo local (solo Marian, terminal).
 * Uso: node --env-file=.env.staging scripts/staging-reset-marian-password.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const STAGING_REF = 'dgkvaorzuebdloegumai'
const EMAIL = 'marianpersonaltrainer@gmail.com'
const OUT = join(root, '.staging-marian-password.txt')

function loadDotEnv() {
  const envPath = join(root, '.env.staging')
  if (!existsSync(envPath)) throw new Error('Falta .env.staging')
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key]) continue
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

async function main() {
  loadDotEnv()
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const ref = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (ref !== STAGING_REF) throw new Error('Abortado: no es staging')

  const password = `EvoStaging-${randomBytes(4).toString('hex')}!`
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = list.users.find((u) => u.email?.toLowerCase() === EMAIL)
  if (!user) throw new Error(`Usuario ${EMAIL} no existe en staging`)

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  })
  if (updErr) throw updErr

  const anon = createClient(url, process.env.VITE_SUPABASE_ANON_KEY)
  const { error: loginErr } = await anon.auth.signInWithPassword({ email: EMAIL, password })
  if (loginErr) throw loginErr

  writeFileSync(OUT, `${password}\n`, { mode: 0o600 })
  console.log('OK: contraseña guardada en .staging-marian-password.txt')
  console.log('Ejecuta: cat .staging-marian-password.txt')
  console.log('Copia esa contraseña al navegador (campo Contraseña).')
}

main().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
