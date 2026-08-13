import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260813133500_f1_legacy_trigger_search_path_hardening.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('F1 legacy trigger search_path hardening', () => {
  it('fija un search_path vacío en ambos triggers legacy', () => {
    expect(migration).toContain(
      "alter function public.pe2_sessions_set_updated_at()\n  set search_path = ''",
    )
    expect(migration).toContain(
      "alter function public.pe2_weeks_set_updated_at()\n  set search_path = ''",
    )
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2)
  })

  it('no reemplaza funciones ni modifica tablas o permisos', () => {
    expect(migration).not.toContain('create or replace function')
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate|drop|grant|revoke)\b/)
  })
})
