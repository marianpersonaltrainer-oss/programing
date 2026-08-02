/**
 * Fija la contraseña del programador de preview en STAGING únicamente.
 *
 * Uso (Marian escribe la contraseña en terminal, no en el chat):
 *   cd programingevo-motor-recovery
 *   node scripts/staging-preview-login-setup.mjs
 *
 * Correo por defecto: marianpersonaltrainer@gmail.com
 * Override: STAGING_PREVIEW_EMAIL=otro@ejemplo.com
 *
 * Requiere .env.staging con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de dgkvaorzuebdloegumai.
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const STAGING_REF = 'dgkvaorzuebdloegumai'
const PROD_REF = 'wxrqvcthrkabjllvqghq'
const EMAIL = (process.env.STAGING_PREVIEW_EMAIL || 'marianpersonaltrainer@gmail.com').trim().toLowerCase()

function loadDotEnv() {
  const envPath = join(root, '.env.staging')
  if (!existsSync(envPath)) throw new Error('Falta .env.staging en el worktree del PR.')
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key] != null && process.env[key] !== '') continue
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

function assertStagingOnly(url) {
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
  if (ref !== STAGING_REF) throw new Error(`Abortado: URL no es staging (${ref || 'desconocido'}).`)
  if (ref === PROD_REF) throw new Error('Abortado: apunta a producción.')
}

async function askPasswordHidden(prompt) {
  if (!process.stdin.isTTY) {
    return askPasswordVisible(
      'La terminal no es interactiva. Escribe la contraseña aquí abajo (se verá al escribir, min. 12): ',
    )
  }
  try {
    process.stdout.write(`${prompt}\n(Escribe en la terminal de abajo, NO en el navegador. No se verá al escribir.)\n`)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    return await new Promise((resolve, reject) => {
      let value = ''
      const onData = (char) => {
        if (char === '\u0003') {
          cleanup()
          reject(new Error('Cancelado'))
          return
        }
        if (char === '\r' || char === '\n') {
          cleanup()
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (char === '\u007f') {
          value = value.slice(0, -1)
          return
        }
        value += char
      }
      function cleanup() {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', onData)
      }
      process.stdin.on('data', onData)
    })
  } catch {
    return askPasswordVisible('Escribe la contraseña aquí abajo (se verá al escribir, min. 12): ')
  }
}

function askPasswordVisible(prompt) {
  return new Promise((resolve) => {
    import('readline').then(({ createInterface }) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      rl.question(`${prompt}\n`, (answer) => {
        rl.close()
        resolve(answer)
      })
    })
  })
}

async function main() {
  loadDotEnv()
  const url = process.env.SUPABASE_URL || process.env.STAGING_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  assertStagingOnly(url)

  const password =
    process.env.STAGING_PREVIEW_PASSWORD?.trim() ||
    (await askPasswordHidden('Escribe la contraseña aquí (no se verá) y pulsa Enter: '))
  if (!password || password.length < 12) {
    console.error('La contraseña debe tener al menos 12 caracteres.')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let orgId
  const { data: existingOrg } = await admin.from('organizations').select('id').eq('slug', 'evo').maybeSingle()
  if (existingOrg?.id) orgId = existingOrg.id
  else {
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({ name: 'EVO Staging', slug: 'evo' })
      .select('id')
      .single()
    if (orgErr) throw orgErr
    orgId = org.id
  }

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) throw listErr
  let user = list.users.find((u) => u.email?.toLowerCase() === EMAIL)
  if (!user) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Marian EVO' },
    })
    if (createErr) throw createErr
    user = created.user
    console.log('OK: usuario creado en staging:', EMAIL)
  } else {
    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    })
    if (updErr) throw updErr
  }

  const { error: profUpsertErr } = await admin.from('profiles').upsert(
    {
      id: user.id,
      full_name: 'Marian EVO',
      role: 'programmer',
      org_id: orgId,
    },
    { onConflict: 'id' },
  )
  if (profUpsertErr) throw profUpsertErr

  const anon = createClient(url, process.env.VITE_SUPABASE_ANON_KEY)
  const { error: loginErr } = await anon.auth.signInWithPassword({ email: EMAIL, password })
  if (loginErr) throw new Error(`Login fallido tras actualizar: ${loginErr.message}`)

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('role, org_id, full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (profErr) throw profErr
  if (profile?.role !== 'programmer') {
    throw new Error(`Rol incorrecto: ${profile?.role || 'sin perfil'}`)
  }

  console.log('OK: acceso staging listo para', EMAIL)
  console.log('OK: login verificado')
  console.log('OK: rol programmer, org_id presente:', Boolean(profile?.org_id))
}

main().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
