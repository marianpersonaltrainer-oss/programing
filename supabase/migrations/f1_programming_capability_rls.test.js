import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260813150514_f1_programming_capability_rls.sql', import.meta.url),
  'utf8',
).toLowerCase()

const policyNames = [
  'organizations_select_member',
  'profiles_select_authorized',
  'pe2_programmer_state_own',
  'pe2_weeks_programmer_all',
  'pe2_weeks_coach_select_published',
  'pe2_class_types_programmer_all',
  'pe2_exercises_programmer_all',
  'pe2_sessions_programmer_all',
  'pe2_blocks_programmer_all',
  'pe2_block_items_programmer_all',
  'pe2_sessions_coach_select_published',
  'pe2_blocks_coach_select_published',
  'pe2_block_items_coach_select_published',
  'pe2_class_types_coach_select',
  'pe2_exercises_coach_select',
  'shift_notes_insert_own',
  'shift_notes_select_authorized',
  'shift_protocol_logs_insert_own',
  'shift_protocol_logs_select_authorized',
]

describe('F1 Programming capability-based RLS', () => {
  it('reemplaza las 19 políticas legacy sin cambiar sus nombres', () => {
    for (const policyName of policyNames) {
      expect(migration).toContain(`drop policy if exists ${policyName}`)
      expect(migration).toContain(`create policy ${policyName}`)
    }
  })

  it('no autoriza mediante profiles.role o profiles.org_id', () => {
    expect(migration).not.toContain('pe2_my_role')
    expect(migration).not.toContain('pe2_my_org')
    expect(migration).not.toContain('user_metadata')
    expect(migration).not.toContain('raw_user_meta_data')
  })

  it('mapea los permisos existentes a capacidades explícitas', () => {
    expect(migration).toContain("'programming.manage'")
    expect(migration).toContain("'programming.read_published'")
    expect(migration).toContain("'coach.workspace.access'")
    expect(migration).toContain('private.evo_has_capability')
  })

  it('mantiene el aislamiento por organización y usuario', () => {
    expect(migration).toContain('private.evo_has_active_membership(id)')
    expect(migration).toContain('user_id = (select auth.uid())')
    expect(migration).toContain(
      "memberships.organization_id = target_organization_id",
    )
    expect(migration).toContain("memberships.status = 'active'")
  })

  it('protege el helper de membership como SECURITY DEFINER privado', () => {
    expect(migration).toContain(
      'create or replace function private.evo_has_active_membership',
    )
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain(
      'revoke all on function private.evo_has_active_membership(uuid)',
    )
    expect(migration).toContain(
      'grant execute on function private.evo_has_active_membership(uuid)',
    )
  })

  it('preserva la ventana temporal y la propiedad de logs de coach', () => {
    expect(migration).toContain("timezone('europe/madrid', now())")
    expect(migration).toContain("interval '1 day'")
    expect(migration).toContain('user_id = (select auth.uid())')
  })
})
