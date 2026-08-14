import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const client = readFileSync(new URL('./supabase.js', import.meta.url), 'utf8')
const coach = readFileSync(
  new URL('../components/CoachView/CoachView.jsx', import.meta.url),
  'utf8',
)
const server = readFileSync(
  new URL('../../api/coach-weekly-checkin.js', import.meta.url),
  'utf8',
)

describe('EVO Coach individual Auth transition contract', () => {
  it('coordina flags cliente y servidor sin eliminar el rollback legacy', () => {
    expect(client).toContain('isCoachIndividualAuthEnabled()')
    expect(coach).toContain('isCoachIndividualAuthEnabled()')
    expect(server).toContain('COACH_INDIVIDUAL_AUTH_ENABLED')
    expect(server).toContain('COACH_SHARED_CODE_FALLBACK_ENABLED')
    expect(server).toContain("method: 'coach_access_code'")
  })

  it('solo sustituye el código compartido si la sesión tiene un contexto Coach único', () => {
    expect(client).toContain(".rpc('evo_my_capabilities')")
    expect(client).toContain('hasUniqueCoachCapabilityContext(capabilityRows)')
    expect(client).toContain('hasIndividualSession = true')
    expect(client).toContain('&& !hasIndividualSession')
    expect(client).toContain('headers.Authorization = `Bearer ${token}`')
  })

  it('mantiene el rollback legacy para sesiones sin capacidad Coach', () => {
    expect(client).toContain('if (individualAccessToken)')
    expect(client).toContain('session?.user && !isCoachIndividualAuthEnabled()')
    expect(client).toContain('return createWeeklyCheckinViaServer(payload, { accessCode })')
    expect(client).toContain('isCoachSharedCodeFallbackEnabled()')
  })

  it('protege el check-in por capability, origen y rate limit', () => {
    expect(server).toContain("requireCapabilityImpl(req, 'coach.workspace.access')")
    expect(server).toContain('isEvoOriginAllowed(originValue)')
    expect(server).toContain("endpoint: '/api/coach-weekly-checkin'")
    expect(server).not.toContain('error.message')
    expect(server).not.toContain('error.details')
  })
})
