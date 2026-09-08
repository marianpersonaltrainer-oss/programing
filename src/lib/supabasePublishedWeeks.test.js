import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY = 'test-publishable-key'
})

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mocks.from,
    auth: { getSession: mocks.getSession },
  }),
}))

import {
  getPublishedWeekDraftByMesocycleAndWeek,
  upsertPublishedWeekBySlot,
} from './supabase.js'

const weekData = {
  titulo: 'Semana 5',
  mesociclo: 'fuerza',
  semana: 5,
  dias: [{ nombre: 'LUNES', evofuncional: 'PARTE ÚNICA · AMRAP 20’' }],
}

const approvedGate = {
  version: 1,
  status: 'approved',
  source_status: 'aprobado',
  score: 91,
  blockers: [],
  pending: [],
  content_fingerprint: 'fp1-evaluacion-exacta',
  validation_fingerprint: 'fp1-evaluacion-exacta',
  validated_at: '2026-07-23T20:00:00.000Z',
}

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

describe('published_weeks versionadas en el cliente', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    })
    globalThis.fetch = vi.fn()
    mocks.from.mockClear()
  })

  afterEach(() => {
    delete globalThis.fetch
  })

  it('un guardado normal solo solicita un borrador al endpoint protegido', async () => {
    fetch.mockResolvedValue(
      response({
        row: { id: 'draft-1', revision: 1, publication_status: 'draft' },
        active: false,
      }),
    )

    const result = await upsertPublishedWeekBySlot(weekData, 'fuerza', 5, {
      activateForHub: false,
    })

    expect(result.active).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [, request] = fetch.mock.calls[0]
    expect(request.headers.Authorization).toBe('Bearer session-token')
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        action: 'save_draft',
        mesocycle: 'fuerza',
        week: 5,
        qualityGate: null,
        draftId: null,
        expectedRevision: 0,
      }),
    )
  })

  it('lee un borrador exacto por la API autenticada, no por la tabla pública', async () => {
    fetch.mockResolvedValue(
      response({
        row: {
          id: 'draft-1',
          revision: 2,
          cycle_id: 'fuerza:2026-06-29',
          publication_status: 'draft',
        },
        active: false,
      }),
    )

    const row = await getPublishedWeekDraftByMesocycleAndWeek(
      'fuerza',
      5,
      'fuerza:2026-06-29',
    )

    expect(row?.id).toBe('draft-1')
    expect(mocks.from).not.toHaveBeenCalled()
    const [, request] = fetch.mock.calls[0]
    expect(request.headers.Authorization).toBe('Bearer session-token')
    expect(JSON.parse(request.body)).toEqual({
      action: 'get_draft',
      mesocycle: 'fuerza',
      week: 5,
      cycleId: 'fuerza:2026-06-29',
    })
  })

  it('explica cómo recuperar el acceso si no existe una sesión', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })

    await expect(
      upsertPublishedWeekBySlot(weekData, 'fuerza', 5, { activateForHub: false }),
    ).rejects.toThrow(/Inicia sesión en Mi Oficina EVO/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('conserva la clave legacy solo como respaldo invisible de flujos antiguos', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    fetch.mockResolvedValue(
      response({
        row: { id: 'draft-legacy', revision: 1, publication_status: 'draft' },
        active: false,
      }),
    )

    await upsertPublishedWeekBySlot(weekData, 'fuerza', 5, {
      activateForHub: false,
      adminSecret: 'legacy-secret',
    })

    const [, request] = fetch.mock.calls[0]
    expect(request.headers.Authorization).toBeUndefined()
    expect(JSON.parse(request.body).secret).toBe('legacy-secret')
  })

  it('envía la identidad y revisión capturadas al actualizar un borrador', async () => {
    fetch.mockResolvedValue(
      response({
        row: { id: 'draft-1', revision: 3, publication_status: 'draft' },
        active: false,
      }),
    )

    await upsertPublishedWeekBySlot(weekData, 'fuerza', 5, {
      activateForHub: false,
      draftId: 'draft-1',
      expectedRevision: 2,
    })

    const [, request] = fetch.mock.calls[0]
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        action: 'save_draft',
        draftId: 'draft-1',
        expectedRevision: 2,
      }),
    )
  })

  it('no permite actualizar un borrador sin su revisión exacta', async () => {
    await expect(
      upsertPublishedWeekBySlot(weekData, 'fuerza', 5, {
        activateForHub: false,
        draftId: 'draft-1',
      }),
    ).rejects.toThrow(/revisión exacta/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rechaza una publicación bloqueada antes de llamar al servidor', async () => {
    const blockedGate = {
      ...approvedGate,
      status: 'blocked',
      blockers: ['Intervalos en días consecutivos.'],
    }

    await expect(
      upsertPublishedWeekBySlot(weekData, 'fuerza', 5, {
        activateForHub: true,
        qualityGate: blockedGate,
      }),
    ).rejects.toThrow(/Publicación bloqueada/)

    expect(fetch).not.toHaveBeenCalled()
  })

  it('delega la transacción completa de publicación al servidor', async () => {
    fetch.mockResolvedValue(
      response({
        row: {
          id: 'published-2',
          publication_status: 'published',
          is_active: true,
        },
        active: true,
      }),
    )

    const result = await upsertPublishedWeekBySlot(weekData, 'fuerza', 5, {
      activateForHub: true,
      qualityGate: approvedGate,
      sourceWeekId: 'published-1',
    })

    expect(result.active).toBe(true)
    const [, request] = fetch.mock.calls[0]
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({
        action: 'publish',
        sourceWeekId: 'published-1',
        qualityGate: approvedGate,
        draftId: null,
        expectedRevision: 0,
      }),
    )
  })

  it('propaga un conflicto de revisión de otra pestaña', async () => {
    fetch.mockResolvedValue(
      response(
        { error: 'draft_revision_conflict', code: '40001' },
        { ok: false, status: 409 },
      ),
    )

    await expect(
      upsertPublishedWeekBySlot(weekData, 'fuerza', 5, {
        activateForHub: false,
      }),
    ).rejects.toMatchObject({
      message: 'draft_revision_conflict',
      code: '40001',
    })
  })
})
