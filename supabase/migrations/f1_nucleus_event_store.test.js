import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260813152752_f1_nucleus_event_store.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('F1 Nucleus canonical event store', () => {
  it('persiste el sobre canónico de la Arquitectura Maestra', () => {
    for (const field of [
      'event_id',
      'event_type',
      'occurred_at',
      'observed_at',
      'source',
      'organization_id',
      'person_id',
      'external_id',
      'schema_version',
      'payload',
      'idempotency_key',
      'correlation_id',
      'causation_id',
      'source_updated_at',
      'reconciled_at',
      'sync_status',
    ]) {
      expect(migration).toMatch(new RegExp(`\\b${field}\\b`))
    }
  })

  it('impide duplicar el mismo hecho por organización y fuente', () => {
    expect(migration).toContain(
      'on public.evo_events (organization_id, source, idempotency_key)',
    )
    expect(migration).toContain('create unique index')
  })

  it('valida formato, tamaño, tiempo, causalidad, versión y reconciliación', () => {
    for (const constraint of [
      'evo_events_event_type_format_check',
      'evo_events_source_format_check',
      'evo_events_payload_object_check',
      'evo_events_payload_size_check',
      'evo_events_observation_order_check',
      'evo_events_causation_not_self_check',
      'evo_events_reconciled_timestamp_check',
      'evo_events_schema_version_check',
    ]) {
      expect(migration).toContain(`constraint ${constraint}`)
    }
  })

  it('queda append-only incluso para el escritor server-side', () => {
    expect(migration).toContain(
      'create or replace function private.evo_prevent_canonical_event_mutation()',
    )
    expect(migration).toContain("raise exception 'evo_events_are_append_only'")
    expect(migration).toContain('before update or delete on public.evo_events')
    expect(migration).not.toContain('grant update')
    expect(migration).not.toContain('grant delete')
  })

  it('no expone eventos ni helpers a anon o authenticated', () => {
    expect(migration).toContain('alter table public.evo_events enable row level security')
    expect(migration).toContain('alter table public.evo_events force row level security')
    expect(migration).toContain(
      'revoke all on table public.evo_events\n  from public, anon, authenticated, service_role',
    )
    expect(migration).toContain(
      'grant select, insert on table public.evo_events\n  to service_role',
    )
    expect(migration).not.toMatch(/create policy[\s\S]*?on public\.evo_events/)
  })

  it('no acopla person_id a auth.users antes de definir la identidad Persona', () => {
    expect(migration).toContain('person_id uuid,')
    expect(migration).not.toContain('person_id uuid references auth.users')
  })
})
