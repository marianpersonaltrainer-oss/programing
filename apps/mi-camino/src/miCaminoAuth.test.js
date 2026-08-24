import { describe, expect, it } from 'vitest'
import { selectMiCaminoProjection } from './miCaminoAuth.js'

const ROW = Object.freeze({
  id: '018f1f4d-7b6c-7d8e-9f10-111213141540',
  organization_id: '018f1f4d-7b6c-7d8e-9f10-111213141541',
  person_id: '018f1f4d-7b6c-7d8e-9f10-111213141542',
  entry_mode: 'new',
  journey_day: 2,
  stage_key: 'concierge_0_14',
  next_action: {},
  progress: {},
  freshness: {},
  schema_version: 1,
  updated_at: '2026-08-18T09:00:00.000Z',
})

describe('Mi Camino projection selection', () => {
  it('devuelve únicamente la proyección única que RLS expone a la identidad', () => {
    expect(selectMiCaminoProjection([ROW])).toEqual(expect.objectContaining({
      projection_id: ROW.id,
      organization_id: ROW.organization_id,
      person_id: ROW.person_id,
      data_class: 'P2',
    }))
  })

  it('no inventa un recorrido cuando la identidad no tiene acceso', () => {
    expect(selectMiCaminoProjection([])).toBeNull()
  })

  it('falla cerrado si una identidad tiene más de un recorrido y aún no existe selector de organización', () => {
    expect(() => selectMiCaminoProjection([ROW, { ...ROW, id: '018f1f4d-7b6c-7d8e-9f10-111213141543' }]))
      .toThrow('mi_camino_multiple_accesses')
  })
})
