import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const gate = readFileSync(new URL('./CoachAuthGate.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
const coach = readFileSync(new URL('./CoachView.jsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../../lib/supabase.js', import.meta.url), 'utf8')
const accessMode = readFileSync(new URL('../../lib/coachAccessMode.js', import.meta.url), 'utf8')

describe('EVO Coach individual Auth gate', () => {
  it('exige sesión y capability cuando staging apaga el fallback', () => {
    expect(app).toContain("import('./components/CoachView/CoachAuthGate.jsx')")
    expect(gate).toContain('isCoachIndividualAuthEnabled()')
    expect(gate).toContain('!isCoachSharedCodeFallbackEnabled()')
    expect(gate).toContain("auth.can('coach.workspace.access')")
    expect(gate).toContain('<Pe2Login')
  })

  it('conserva Coach legacy como rollback mientras el fallback siga activo', () => {
    expect(gate).toContain('individualRequired ? <CoachIndividualAuthGate /> : <CoachView />')
  })

  it('falla cerrado en UI y operaciones si falta identidad individual', () => {
    expect(coach).toContain('resolveCoachAccessMode')
    expect(accessMode).toContain("return 'denied'")
    expect(client).toContain('&& isCoachSharedCodeFallbackEnabled()')
    expect(client).toContain('const accessCode = isCoachSharedCodeFallbackEnabled()')
  })
})
