import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260813011500_evo_identity_multirole_foundation.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('EVO-S identity multirole foundation', () => {
  it('modela memberships multirrol sin retirar el puente legacy', () => {
    expect(migration).toContain('create table if not exists public.evo_memberships')
    expect(migration).toContain('unique (user_id, organization_id, role_key)')
    expect(migration).toContain("'legacy_profiles'")
    expect(migration).not.toContain('drop column role')
    expect(migration).not.toContain('drop column org_id')
  })

  it('sincroniza cambios autorizados del puente legacy sin reactivar asignaciones manuales antiguas', () => {
    expect(migration).toContain(
      'create or replace function private.evo_sync_legacy_profile_membership()',
    )
    expect(migration).toContain(
      'after insert or update of role, org_id on public.profiles',
    )
    expect(migration).toContain("and source = 'legacy_profiles'")
    expect(migration).toContain(
      "on conflict (user_id, organization_id, role_key)\n    do update set status = 'active'",
    )
    expect(migration).toContain(
      'revoke all on function private.evo_sync_legacy_profile_membership()',
    )
  })

  it('cierra la edición autenticada de role y org_id en profiles', () => {
    expect(migration).toContain(
      'revoke all on table public.profiles from public, anon, authenticated',
    )
    expect(migration).toContain(
      'grant update (full_name) on table public.profiles to authenticated',
    )
    expect(migration).not.toContain(
      'grant update (role) on table public.profiles to authenticated',
    )
    expect(migration).not.toContain(
      'grant update (org_id) on table public.profiles to authenticated',
    )
  })

  it('permite leer únicamente las memberships propias', () => {
    expect(migration).toContain('alter table public.organizations enable row level security')
    expect(migration).toContain('alter table public.profiles enable row level security')
    expect(migration).toContain('alter table public.evo_memberships enable row level security')
    expect(migration).toContain('create policy evo_memberships_select_own')
    expect(migration).toContain('using (user_id = (select auth.uid()))')
    expect(migration).toContain(
      'revoke all on table public.evo_memberships from public, anon, authenticated',
    )
    expect(migration).toContain(
      'grant select on table public.evo_memberships to authenticated',
    )
  })

  it('resuelve capacidades desde tablas protegidas, no desde user_metadata', () => {
    expect(migration).toContain('create or replace function private.evo_has_capability')
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('memberships.user_id = (select auth.uid())')
    expect(migration).toContain("memberships.status = 'active'")
    expect(migration).not.toContain('user_metadata')
    expect(migration).not.toContain('raw_user_meta_data')
  })

  it('no expone funciones privilegiadas a anon o PUBLIC', () => {
    expect(migration.indexOf('create schema if not exists private')).toBeLessThan(
      migration.indexOf(
        'create or replace function private.evo_sync_legacy_profile_membership()',
      ),
    )
    expect(migration).toContain(
      'revoke all on function private.evo_has_capability(uuid, text)',
    )
    expect(migration).toContain(
      'revoke all on function public.evo_my_capabilities()',
    )
    expect(migration).toContain(
      'grant execute on function public.evo_my_capabilities()\n  to authenticated, service_role',
    )
  })

  it('endurece los helpers SECURITY DEFINER legacy mientras siguen en uso', () => {
    expect(migration).toContain('create or replace function public.pe2_my_org()')
    expect(migration).toContain('create or replace function public.pe2_my_role()')
    expect(migration).toContain(
      'revoke all on function public.pe2_my_org()\n  from public, anon, authenticated',
    )
    expect(migration).toContain(
      'revoke all on function public.pe2_my_role()\n  from public, anon, authenticated',
    )
    expect(migration).toContain(
      "security definer\nset search_path = ''",
    )
  })
})
