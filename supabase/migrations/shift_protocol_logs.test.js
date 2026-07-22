import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./20260722210000_shift_protocol_logs.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('migración shift_protocol_logs', () => {
  it('impone identidad, organización y hora desde la base de datos', () => {
    expect(sql).toContain('user_id uuid not null default auth.uid()')
    expect(sql).toContain('org_id uuid not null default public.pe2_my_org()')
    expect(sql).toContain('created_at timestamptz not null default now()')
  })

  it('no crea una unicidad diaria y permite múltiples registros', () => {
    expect(sql).not.toMatch(/unique\s*\([^)]*(user_id|record_type|created_at)/)
  })

  it('valida incidencias y completados también en SQL', () => {
    expect(sql).toContain('shift_protocol_logs_incident_comment_check')
    expect(sql).toContain("coalesce(comment, '') ~ '[^[:space:]]'")
    expect(sql).toContain('shift_protocol_logs_completed_confirmation_check')
  })

  it('fija la versión V0 también en la base de datos', () => {
    expect(sql).toContain("protocol_version text not null default 'v0'")
    expect(sql).toContain("check (protocol_version = 'v0')")
  })

  it('concede inserción limitada y no concede edición ni borrado', () => {
    const logsPermissions = sql.slice(
      sql.indexOf('revoke all on table public.shift_protocol_logs'),
      sql.indexOf('drop policy if exists shift_protocol_logs_insert_own'),
    )
    expect(sql).toContain('grant insert (')
    expect(logsPermissions).not.toMatch(/grant\s+update/)
    expect(logsPermissions).not.toMatch(/grant\s+delete/)
  })

  it('separa lectura propia y lectura de Dirección', () => {
    expect(sql).toContain('shift_protocol_logs_select_own')
    expect(sql).toContain('shift_protocol_logs_select_direction')
    expect(sql).toContain("public.pe2_my_role() = 'programmer'")
    expect(sql).toContain("timezone('europe/madrid', now())")
    expect(sql).toContain("interval '1 day'")
  })

  it('impide que un entrenador se asigne el rol de Dirección', () => {
    expect(sql).toContain('drop policy if exists profiles_update_own')
    expect(sql).toContain('revoke update on table public.profiles from authenticated')
    expect(sql).toContain('grant update (full_name) on table public.profiles to authenticated')
    expect(sql).not.toMatch(/grant update \([^)]*(role|org_id)/)
  })

  it('reserva la creación de registros al rol entrenador', () => {
    expect(sql).toContain("public.pe2_my_role() = 'coach'")
    expect(sql).not.toContain("public.pe2_my_role() in ('coach', 'programmer')")
  })
})
