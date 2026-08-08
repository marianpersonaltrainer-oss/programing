import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  new URL('./20260808120000_guided_shift_control.sql', import.meta.url),
  'utf8',
)
const policyTuningSql = readFileSync(
  new URL('./20260808140000_guided_shift_control_policy_tuning.sql', import.meta.url),
  'utf8',
)
const sql = `${migrationSql}\n${policyTuningSql}`.toLowerCase()

describe('migración shift_protocol_logs', () => {
  it('impone identidad, organización y hora desde la base de datos', () => {
    expect(sql).toContain('shift_id uuid not null')
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
    expect(sql).toContain("all_steps_confirmed = (result = 'completado')")
    expect(sql).toContain('shift_protocol_logs_comment_length_check')
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
    expect(sql).toContain("(select public.pe2_my_role()) = 'programmer'")
    expect(sql).toContain("timezone('europe/madrid', now())")
    expect(sql).toContain("interval '1 day'")
    expect(sql).toContain('shift_protocol_logs_select_authorized')
  })

  it('impide que un entrenador se asigne el rol de Dirección', () => {
    expect(sql).toContain('drop policy if exists profiles_update_own')
    expect(sql).toContain('revoke all on table public.profiles from anon, authenticated')
    expect(sql).toContain('grant update (full_name) on table public.profiles to authenticated')
    expect(sql).not.toMatch(/grant update \([^)]*(role|org_id)/)
  })

  it('reserva la creación de registros al rol entrenador', () => {
    expect(sql).toContain("(select public.pe2_my_role()) = 'coach'")
    expect(sql).not.toContain("pe2_my_role()) in ('coach', 'programmer')")
  })

  it('crea notas estructuradas, inmutables y aisladas por organización', () => {
    expect(sql).toContain('create table if not exists public.shift_notes')
    expect(sql).toContain("note_type in ('team', 'post_class')")
    expect(sql).toContain("discomfort_status in ('none', 'stable', 'improved', 'worsened')")
    expect(sql).toContain('discomfort_intensity between 0 and 10')
    expect(sql).toContain('work_volume_percent in (25, 50, 75, 100)')
    expect(sql).toContain('shift_notes_select_team')
    expect(sql).toContain('shift_notes_select_direction')
    expect(sql).toContain('shift_notes_select_authorized')
    expect(sql).toContain("timezone('europe/madrid', now())")

    const notesPermissions = sql.slice(
      sql.indexOf('revoke all on table public.shift_notes'),
      sql.indexOf('drop policy if exists shift_notes_insert_own'),
    )
    expect(notesPermissions).not.toMatch(/grant\s+update/)
    expect(notesPermissions).not.toMatch(/grant\s+delete/)
  })

  it('impone la secuencia y enlaza la primera clase al mismo turno', () => {
    expect(sql).toContain('validate_shift_protocol_log_sequence')
    expect(sql).toContain('validate_shift_note_sequence')
    expect(sql).toContain('log.shift_id = new.shift_id')
    expect(sql).toContain('note.shift_id = new.shift_id')
    expect(sql).toContain('first class follow-up must be completed first')
    expect(sql).toContain('shift_protocol_logs_one_completed_step_idx')
  })
})
