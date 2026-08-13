import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../../Pe2App.jsx', import.meta.url), 'utf8')
const gate = readFileSync(new URL('./RoleGate.jsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('./Pe2Sidebar.jsx', import.meta.url), 'utf8')
const state = readFileSync(new URL('../../lib/pe2Supabase.js', import.meta.url), 'utf8')

describe('PE2 authority comes from memberships and capabilities', () => {
  it('no utiliza profiles.role para abrir un workspace', () => {
    expect(app).not.toMatch(/auth\.role(?!s)/)
    expect(app).toContain("auth.can('programming.manage')")
    expect(app).toContain("auth.can('coach.workspace.access')")
    expect(gate).toContain("workspace === 'programming'")
    expect(gate).not.toContain("role === 'programmer'")
    expect(sidebar).not.toContain('profile?.role')
  })

  it('obtiene la organización operativa de la capability, no del perfil legacy', () => {
    expect(app).toContain("auth.organizationIdFor('programming.manage')")
    expect(state).not.toContain(".from('profiles')")
    expect(state).toContain(".eq('org_id', organizationId)")
    expect(state).toContain('org_id: organizationId')
  })

  it('falla cerrado si no existe un contexto organizativo único', () => {
    expect(state).toContain("throw new Error('No existe un contexto único con programming.manage.')")
  })
})
