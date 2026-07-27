import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./20260723220000_published_weeks_versioned_publication.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('migración published_weeks versionada', () => {
  it('añade el contrato de ciclo de vida, versión y validación', () => {
    for (const column of [
      'cycle_id',
      'cycle_start_date',
      'week_start_date',
      'publication_status',
      'revision',
      'version_number',
      'source_week_id',
      'content_fingerprint',
      'validation_fingerprint',
      'validation_status',
      'validation_score',
      'validation_blockers',
      'validation_pending',
      'validated_at',
      'updated_at',
      'superseded_at',
    ]) {
      expect(sql).toContain(`add column if not exists ${column}`)
    }
    expect(sql).toContain(
      "'legacy_unverified'",
    )
    expect(sql).toContain("'consumed'")
    expect(sql).toContain('check (revision >= 1)')
    expect(sql).toContain('check (version_number >= 1)')
    expect(sql).toContain('published_weeks_cycle_identity_check')
    expect(sql).toContain("cycle_id = format('%s:%s', mesociclo, cycle_start_date)")
  })

  it('normaliza sin borrar historial y limita activo, borrador y versión', () => {
    expect(sql).toContain('ranked_active')
    expect(sql).toContain('published_weeks_one_active_idx')
    expect(sql).toContain('published_weeks_one_mutable_draft_per_slot_idx')
    expect(sql).toContain('published_weeks_slot_version_idx')
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.published_weeks\b/)
    expect(sql).not.toMatch(/\bdrop\s+table\s+(?:if\s+exists\s+)?public\.published_weeks\b/)
    expect(sql).toContain("publication_status = 'legacy_unverified'")
  })

  it('protege publicaciones e históricos frente a edición y borrado', () => {
    expect(sql).toContain('published_weeks_v2_immutable_guard')
    expect(sql).toContain('published_week_history_is_immutable')
    expect(sql).toContain('published_week_content_is_immutable')
    expect(sql).toContain('draft_must_be_published_as_new_version')
    expect(sql).toContain(
      "- array['publication_status', 'is_active', 'superseded_at', 'updated_at']",
    )
  })

  it('expone únicamente RPCs SECURITY DEFINER para las escrituras del cliente', () => {
    expect(sql).toContain('save_published_week_draft_v2')
    expect(sql).toContain('publish_published_week_draft_v2')
    expect(sql.match(/security definer/g)).toHaveLength(3)
    expect(sql).toContain('set search_path = pg_catalog, public')
    expect(sql).toContain(
      'revoke all on table public.published_weeks from anon, authenticated',
    )
    expect(sql).toContain('grant select on table public.published_weeks to anon, authenticated')
    expect(sql).toContain(
      'grant select, insert, update on table public.published_weeks to service_role',
    )
    expect(sql).toContain('from anon, authenticated')
    expect(sql).not.toContain('to anon, authenticated, service_role')
    expect(sql.match(/\) to service_role;/g)).toHaveLength(3)
    expect(sql).toContain('alter table public.published_weeks enable row level security')
    expect(sql).toContain('create policy published_weeks_public_read_v2')
    expect(sql).toContain(
      "using (publication_status in ('published', 'superseded'))",
    )
    expect(sql).toContain(
      'revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated',
    )
    expect(sql).toContain(
      'grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role',
    )
  })

  it('serializa borrador y activación con revisión optimista', () => {
    expect(sql).toContain('draft_revision_conflict')
    expect(sql).toContain('draft_exists_pass_id_and_expected_revision')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('published_weeks:global_active')
    expect(sql).toContain('for update')
    expect(sql).toContain('revision = revision + 1')
    expect(sql).toContain('publication_context_snapshot_invalid')
    expect(sql).toContain('published_at > v_context_snapshot_at')
    expect(sql).toContain('publication_context_changed')
  })

  it('bloquea la publicación salvo aprobación exacta y fresca', () => {
    expect(sql).toContain("validation_status <> 'approved'")
    expect(sql).toContain('validation_score_below_80')
    expect(sql).toContain('coalesce(v_draft.validation_score, -1) < 80')
    expect(sql).toContain(
      "<> v_draft.validation_fingerprint",
    )
    expect(sql).toContain('p_expected_validation_fingerprint')
    expect(sql).toContain('jsonb_array_length(v_draft.validation_blockers) <> 0')
    expect(sql).toContain('jsonb_array_length(v_draft.validation_pending) <> 0')
    expect(sql).toContain('validated_at_required')
    expect(sql).toContain(
      'md5 canónico calculado por postgresql sobre data::text',
    )
    expect(sql).toContain(
      'huella fp1 del objetivo evaluado (documento + ciclo/contexto)',
    )
  })

  it('publica una fila nueva, enlaza el borrador y lo consume sin estado colgado', () => {
    expect(sql).toContain('save_and_publish_published_week_v2')
    expect(sql).toContain('return public.publish_published_week_draft_v2')
    expect(sql).toContain("'source_week_id', v_published.source_week_id")
    expect(sql).toContain("'consumed_draft_id', v_draft.id")
    expect(sql).toContain('v_draft.id,')
    expect(sql).toContain("publication_status = 'consumed'")
    expect(sql).not.toContain("publication_status = 'publishing'")
    expect(sql).toContain(
      "perform set_config('app.published_weeks_v2_internal', 'on', true)",
    )
  })
})
