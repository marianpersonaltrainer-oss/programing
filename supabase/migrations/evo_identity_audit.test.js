import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260813131215_evo_identity_audit.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('EVO-S identity audit', () => {
  it('registra cambios de memberships y asignaciones de capabilities', () => {
    expect(migration).toContain('create table if not exists public.evo_identity_audit_log')
    expect(migration).toContain('after insert or update or delete on public.evo_memberships')
    expect(migration).toContain('after insert or update or delete on public.evo_role_capabilities')
  })

  it('limita el payload a identificadores técnicos y estados', () => {
    expect(migration).toContain('subject_user_id uuid')
    expect(migration).toContain('organization_id uuid')
    expect(migration).toContain('capability_key text')
    expect(migration).not.toMatch(/\n\s*email\s+text/)
    expect(migration).not.toMatch(/\n\s*full_name\s+text/)
    expect(migration).not.toMatch(/\n\s*metadata\s+/)
    expect(migration).not.toMatch(/\n\s*secret\s+text/)
  })

  it('es append-only y no queda expuesta por Data API', () => {
    expect(migration).toContain('alter table public.evo_identity_audit_log force row level security')
    expect(migration).toContain(
      'revoke all on table public.evo_identity_audit_log\n  from public, anon, authenticated, service_role',
    )
    expect(migration).not.toContain('grant select on table public.evo_identity_audit_log')
    expect(migration).not.toMatch(/create policy[\s\S]*evo_identity_audit/i)
    expect(migration).toContain(
      'before update or delete on public.evo_identity_audit_log',
    )
    expect(migration).toContain(
      "raise exception 'evo_identity_audit_log_is_append_only'",
    )
  })

  it('endurece las funciones trigger privilegiadas', () => {
    expect(migration).toContain('create or replace function private.evo_audit_membership_change()')
    expect(migration).toContain('create or replace function private.evo_audit_role_capability_change()')
    expect(migration.match(/security definer/g)).toHaveLength(2)
    expect(migration.match(/set search_path = ''/g)).toHaveLength(3)
    expect(migration).toContain(
      'revoke all on function private.evo_audit_membership_change()',
    )
    expect(migration).toContain(
      'revoke all on function private.evo_audit_role_capability_change()',
    )
  })
})
