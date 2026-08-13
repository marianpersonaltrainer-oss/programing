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
    expect(server).toContain("method: 'coach_access_code'")
  })

  it('no envía el código compartido cuando existe una sesión individual habilitada', () => {
    expect(client).toContain('hasIndividualSession = true')
    expect(client).toContain('&& !hasIndividualSession')
    expect(client).toContain('headers.Authorization = `Bearer ${token}`')
  })

  it('protege el check-in por capability, origen y rate limit', () => {
    expect(server).toContain("requireCapabilityImpl(req, 'coach.workspace.access')")
    expect(server).toContain('isEvoOriginAllowed(originValue)')
    expect(server).toContain("endpoint: '/api/coach-weekly-checkin'")
    expect(server).not.toContain('error.message')
    expect(server).not.toContain('error.details')
  })
})
