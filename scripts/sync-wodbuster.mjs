import { createClient } from '@supabase/supabase-js'
import { formatInTimeZone } from 'date-fns-tz'
import { createWodBusterAdapter } from '../integrations/wodbuster/adapter.js'
import { reconcileWodBuster } from '../integrations/wodbuster/reconcile.js'

const required = (name) => {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Falta variable server-side: ${name}`)
  return value
}

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1]
const mode = modeArg || process.env.WODBUSTER_SYNC_MODE || 'frequent'
const timezone = process.env.EVO_TIMEZONE || 'Europe/Madrid'
const now = new Date()

function dayString(date) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd')
}

function subtractDays(date, days) {
  return new Date(date.getTime() - days * 86400000)
}

function resolveWindow() {
  if (mode === 'historical') {
    return {
      from: required('WODBUSTER_SYNC_FROM'),
      to: required('WODBUSTER_SYNC_TO'),
    }
  }
  if (mode === 'daily') {
    return { from: dayString(subtractDays(now, 45)), to: dayString(now) }
  }
  if (mode === 'frequent') {
    return { from: dayString(subtractDays(now, 3)), to: dayString(now) }
  }
  throw new Error(`WODBUSTER_SYNC_MODE no válido: ${mode}`)
}

async function main() {
  const supabaseUrl = required('SUPABASE_URL')
  const serviceRole = required('SUPABASE_SERVICE_ROLE_KEY')
  const orgId = required('MC_ORG_ID')
  const { from, to } = resolveWindow()

  const db = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const adapter = createWodBusterAdapter()

  const result = await reconcileWodBuster({
    adapter,
    db,
    orgId,
    from,
    to,
    now,
    timezone,
  })

  console.log(JSON.stringify({ ok: true, mode, ...result }))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, mode, error: String(error?.message || error) }))
  process.exitCode = 1
})
