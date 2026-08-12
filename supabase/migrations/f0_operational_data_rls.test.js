import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260812160000_f0_default_privilege_hardening.sql', import.meta.url),
  'utf8',
).toLowerCase()

const client = readFileSync(
  new URL('../../src/lib/supabase.js', import.meta.url),
  'utf8',
)

describe('F0 operational data RLS hardening', () => {
  it('retira políticas de escritura anónima y RPC privilegiadas', () => {
    for (const policy of [
      'assistant_week_context_upsert_anon',
      'assistant_question_history_insert_anon',
      'coach_session_feedback_insert_anon',
      'daily_handoffs_insert_anon',
      'ejercicios_sin_video_insert_anon',
      'ejercicios_sin_video_update_anon',
      'pe2_weeks_insert_anon',
      'pe2_weeks_update_anon',
      'weekly_checkins_insert_anon',
      'weekly_checkins_update_anon',
    ]) {
      expect(migration).toContain(`drop policy if exists ${policy}`)
    }
    expect(migration).toContain(
      'revoke all on function public.coach_has_read_handover(uuid, text)',
    )
    expect(migration).toContain(
      'revoke all on function public.record_coach_handover_read(uuid, text)',
    )
  })

  it('deja como públicas solo cuatro lecturas explícitas', () => {
    expect(migration).toContain("'coach_exercise_library'")
    expect(migration).toContain("'coach_guide_settings'")
    expect(migration).toContain("'programming_reference_context'")
    expect(migration).toContain("'published_weeks'")
    expect(migration).toContain("grant select on table public.%i to anon")
  })

  it('el cliente no escribe directamente en las tablas operativas sensibles', () => {
    for (const table of [
      'assistant_week_context',
      'assistant_question_history',
      'coach_session_feedback',
      'coach_handover_reads',
      'daily_handoffs',
      'ejercicios_sin_video',
      'coach_sessions',
      'coach_messages',
    ]) {
      expect(client).not.toContain(`.from('${table}')`)
    }
    expect(client).not.toContain(".rpc('coach_has_read_handover'")
    expect(client).not.toContain(".rpc('record_coach_handover_read'")
  })
})
