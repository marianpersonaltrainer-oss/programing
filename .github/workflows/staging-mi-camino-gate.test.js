import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  new URL('./staging-mi-camino-gate.yml', import.meta.url),
  'utf8',
)

describe('Staging Mi Camino privacy gate workflow', () => {
  it('es manual, limitado a staging y no reutiliza secretos de producción', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('environment: staging')
    expect(workflow).toContain('SUPABASE_STAGING_DB_URL')
    expect(workflow).not.toContain('secrets.SUPABASE_DB_URL')
    expect(workflow).not.toContain('SUPABASE_PRODUCTION_PROJECT_REF')
    expect(workflow).not.toMatch(/\bproduction\b/i)
  })

  it('no acepta SQL ni archivos arbitrarios y exige una confirmación literal antes de escribir', () => {
    expect(workflow).toContain('20260818120000_f1_mi_camino_read_own_hardening.sql')
    expect(workflow).toContain('STAGING_MI_CAMINO_HARDENING')
    expect(workflow).toContain("env.OPERATION == 'apply_hardening'")
    expect(workflow).not.toContain('inputs.sql')
    expect(workflow).not.toContain('inputs.migration')
  })

  it('rechaza una URL no identificada como staging y verifica RLS, grants y Nucleus sin datos personales', () => {
    expect(workflow).toContain('STAGING_PROJECT_REF: dgkvaorzuebdloegumai')
    expect(workflow).toContain('Approved staging connection shape.')
    expect(workflow).toContain("has_function_privilege('anon'")
    expect(workflow).toContain("has_table_privilege('authenticated', 'public.mi_camino_projections', 'INSERT')")
    expect(workflow).toContain("to_regclass('public.evo_events')")
    expect(workflow).toContain("evo_events_idempotency_uidx")
    expect(workflow).toContain("evo_prevent_canonical_event_mutation")
    expect(workflow).toContain("has_table_privilege('anon', 'public.evo_events'")
    expect(workflow).toContain("to_regclass('public.evo_memberships')")
    expect(workflow).toContain("public.evo_my_capabilities()'::regprocedure")
    expect(workflow).toContain("function_def.proname = 'evo_has_capability'")
    expect(workflow).toContain("function_source not like '%public.evo_memberships%'")
    expect(workflow).not.toContain('select *')
  })
})
