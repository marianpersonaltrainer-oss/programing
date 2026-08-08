export const PRODUCTION_SUPABASE_REF = 'wxrqvcthrkabjllvqghq'
export const STAGING_SUPABASE_REF = 'dgkvaorzuebdloegumai'
export const CANONICAL_VERCEL_PROJECT_ID = 'prj_sEYLABB5nQ6AYEWEdwBDtWI0wnQ4'

const PRIVATE_VITE_NAME = /^VITE_.*(?:ANTHROPIC_API_KEY|SERVICE_ROLE|PRIVATE_KEY|ADMIN_SECRET|SECRET_KEY)/i

export function getSupabaseRef(value = '') {
  const match = String(value).trim().match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)
  return match?.[1] || ''
}

function legacyJwtRole(value = '') {
  const parts = String(value).split('.')
  if (parts.length !== 3) return ''
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return String(payload.role || '')
  } catch {
    return ''
  }
}

export function deploymentTargetErrors(env = {}) {
  const errors = []
  for (const [name, value] of Object.entries(env)) {
    if (PRIVATE_VITE_NAME.test(name) && String(value || '').trim()) {
      errors.push(`${name} es privada y no puede exponerse con el prefijo VITE_.`)
    }
  }

  const publicSupabaseKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (publicSupabaseKey.startsWith('sb_secret_') || legacyJwtRole(publicSupabaseKey) === 'service_role') {
    errors.push('VITE_SUPABASE_ANON_KEY contiene una clave privada de Supabase.')
  }

  const vercelEnv = String(env.VERCEL_ENV || '').trim().toLowerCase()
  if (!vercelEnv) return errors
  if (!['preview', 'production', 'development'].includes(vercelEnv)) {
    errors.push(`VERCEL_ENV no reconocido: ${vercelEnv}.`)
    return errors
  }
  if (vercelEnv === 'development') return errors

  const publicRef = getSupabaseRef(env.VITE_SUPABASE_URL)
  const serverUrl = String(env.SUPABASE_URL || '').trim()
  const serverRef = serverUrl ? getSupabaseRef(serverUrl) : publicRef
  if (!publicRef) errors.push('Falta una VITE_SUPABASE_URL válida para este despliegue.')
  if (!publicSupabaseKey) errors.push('Falta VITE_SUPABASE_ANON_KEY para este despliegue.')
  if (serverUrl && !serverRef) errors.push('SUPABASE_URL no es una URL válida de proyecto Supabase.')

  const expectedRef = vercelEnv === 'preview' ? STAGING_SUPABASE_REF : PRODUCTION_SUPABASE_REF
  if (publicRef && publicRef !== expectedRef) {
    errors.push(`${vercelEnv === 'preview' ? 'Preview' : 'Producción'} debe usar Supabase ${expectedRef}, no ${publicRef}.`)
  }
  if (serverRef && serverRef !== expectedRef) {
    errors.push(`SUPABASE_URL debe apuntar a ${expectedRef} en ${vercelEnv}.`)
  }

  const projectId = String(env.VERCEL_PROJECT_ID || '').trim()
  if (vercelEnv === 'production' && projectId && projectId !== CANONICAL_VERCEL_PROJECT_ID) {
    errors.push('El despliegue de producción solo está permitido en el proyecto Vercel canónico programing-evo.')
  }

  return errors
}

export function validateDeploymentTarget(env = process.env) {
  const errors = deploymentTargetErrors(env)
  if (errors.length) {
    throw new Error(`Despliegue bloqueado por seguridad:\n- ${errors.join('\n- ')}`)
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    validateDeploymentTarget(process.env)
    console.log('Destino de despliegue validado')
  } catch (error) {
    console.error(error.message || error)
    process.exit(1)
  }
}
