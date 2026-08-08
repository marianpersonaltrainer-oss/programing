import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./20260808100000_pe2_auth_foundation.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('base mínima pe2 auth', () => {
  it('crea solo organización, perfiles y helpers requeridos', () => {
    expect(sql).toContain('create table if not exists public.organizations')
    expect(sql).toContain('create table if not exists public.profiles')
    expect(sql).toContain('create or replace function public.pe2_my_org()')
    expect(sql).toContain('create or replace function public.pe2_my_role()')
    expect(sql).not.toContain('public.pe2_weeks')
    expect(sql).not.toContain('public.coach_')
  })

  it('no expone tablas ni helpers a sesiones anónimas', () => {
    expect(sql).toContain('revoke all on table public.organizations from anon, authenticated')
    expect(sql).toContain('revoke all on table public.profiles from anon, authenticated')
    expect(sql).toContain('revoke all on function public.pe2_my_org() from public, anon')
    expect(sql).toContain('grant update (full_name) on table public.profiles to authenticated')
    expect(sql).not.toMatch(/grant update \([^)]*(role|org_id)/)
  })

  it('usa RLS de pertenencia y conserva roles administrados', () => {
    expect(sql).toContain('organizations_select_member')
    expect(sql).toContain('profiles_select_authorized')
    expect(sql).toContain('profiles_update_own')
    expect(sql).toContain("(select public.pe2_my_role()) = 'programmer'")
  })
})
