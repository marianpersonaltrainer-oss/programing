import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(
  fileURLToPath(new URL('./published-week-versions.js', import.meta.url)),
  'utf8',
)
const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../supabase/migrations/20260723220000_published_weeks_versioned_publication.sql',
      import.meta.url,
    ),
  ),
  'utf8',
)

describe('endpoint protegido de versiones publicadas', () => {
  it('exige origen permitido, secreto administrativo y service role', () => {
    expect(source).toContain('isEvoOriginAllowed')
    expect(source).toContain('adminSecretsMatch')
    expect(source).toContain('checkAdminRateLimit')
    expect(source).toContain('COACH_GUIDE_ADMIN_SECRET')
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(source).toContain("error: 'unauthorized'")
  })

  it('sirve borradores solo por la ruta autenticada y con ciclo exacto', () => {
    expect(source).toContain("action === 'get_draft'")
    expect(source).toContain("error: 'invalid_draft_lookup'")
    expect(source).toContain(".eq('cycle_id', cycleId)")
    expect(source).toContain(".eq('publication_status', 'draft')")
    expect(migration).toContain('published_weeks_public_read_v2')
    expect(migration).toContain(
      "using (publication_status in ('published', 'superseded'))",
    )
  })

  it('revalida objetivo, contexto exacto, oferta y Método EVO en el servidor', () => {
    expect(source).toContain('assertPublicationGateApproved')
    expect(source).toContain('buildPublicationTargetFingerprint')
    expect(source).toContain("selection.mode !== 'exact-cycle-date'")
    expect(source).toContain('publication_context_snapshot_invalid')
    expect(source).toContain('publication_context_changed')
    expect(source).toContain('explicit_weekly_offer_required')
    expect(source).toContain('validateEvoWeek')
    expect(source).toContain('requireCompleteOffer: true')
    expect(source).toContain('complete_six_day_week_required')
    expect(source).toContain('week_day_order_mismatch')
    expect(source).toContain('body.draftId')
    expect(source).toContain('body.expectedRevision')
    expect(source).not.toContain('loadMutableDraft')
  })

  it('no concede las RPC de escritura a anon ni authenticated', () => {
    expect(migration).not.toContain('to anon, authenticated, service_role')
    expect(migration.match(/\) to service_role;/g)).toHaveLength(3)
    expect(migration).toContain('from anon, authenticated')
  })

  it('guarda, aprueba y activa una publicación en una sola transacción SQL', () => {
    expect(source).toContain("'save_and_publish_published_week_v2'")
    expect(source).not.toContain("const approved = await saveDraft")
    expect(migration).toContain(
      'create or replace function public.save_and_publish_published_week_v2',
    )
    expect(migration).toContain('return public.publish_published_week_draft_v2')
  })
})
