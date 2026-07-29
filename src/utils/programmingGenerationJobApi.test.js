import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRemoteGenerationJob,
  findRemoteGenerationJobByTarget,
  finishRemoteGenerationJob,
  generateRemoteDayStep,
  remoteSnapshotToLocalJob,
} from './programmingGenerationJobApi.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('programmingGenerationJobApi', () => {
  it('crea un job y devuelve su snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, job: { id: 'job-1', revision: 0 }, steps: [] }),
      })),
    )
    const result = await createRemoteGenerationJob({
      secret: 'test',
      idempotencyKey: 'idem-1',
      fingerprint: 'fp-1',
      generationDays: ['LUNES'],
    })
    expect(result.job.id).toBe('job-1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/programming-generation-jobs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('interpreta errorStatus de una respuesta transmitida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          `   ${JSON.stringify({
            ok: false,
            errorStatus: 504,
            error: 'upstream_timeout',
          })}`,
      })),
    )
    await expect(
      generateRemoteDayStep({ secret: 'test', jobId: 'job-1', day: 'LUNES' }),
    ).rejects.toMatchObject({
      httpStatus: 504,
      code: 'upstream_timeout',
    })
  })

  it('busca un job con un target estable independiente del estado local', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, job: { id: 'job-target' }, steps: [] }),
      })),
    )
    const target = {
      mesocycle: 'FUERZA',
      week: 3,
      cycleId: 'FUERZA:2026-07-13',
    }

    const result = await findRemoteGenerationJobByTarget({
      secret: 'test',
      target,
    })

    expect(result.job.id).toBe('job-target')
    const [, request] = fetch.mock.calls[0]
    expect(JSON.parse(request.body)).toEqual({
      action: 'find_target',
      secret: 'test',
      target,
    })
  })

  it('finaliza con la acción autoritativa y no reenvía campos mutables antiguos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            job: { id: 'job-final', status: 'ready', revision: 4 },
            steps: [],
          }),
      })),
    )
    const partialWeek = { titulo: 'Semana final', dias: [] }

    await finishRemoteGenerationJob({
      secret: 'test',
      jobId: 'job-final',
      expectedRevision: 3,
      partialWeek,
      completedDays: ['LUNES'],
      currentDay: null,
      status: 'ready',
    })

    const [, request] = fetch.mock.calls[0]
    expect(JSON.parse(request.body)).toEqual({
      action: 'finalize',
      secret: 'test',
      jobId: 'job-final',
      expectedRevision: 3,
      partialWeek,
    })
  })

  it('reconstruye el borrador desde steps remotos al cambiar de navegador', () => {
    const result = remoteSnapshotToLocalJob({
      job: {
        id: 'job-1',
        idempotencyKey: 'idem-1',
        fingerprint: 'fp-1',
        status: 'generating',
        target: { week: 3, mesocycle: 'FUERZA' },
        completedDays: ['LUNES'],
        revision: 2,
      },
      steps: [
        {
          status: 'completed',
          day: 'LUNES',
          result: {
            dia: {
              nombre: 'LUNES',
              evofuncional: 'A) Fuerza\nB) Metcon',
            },
          },
        },
      ],
    })

    expect(result).toMatchObject({
      jobId: 'job-1',
      serverJobId: 'job-1',
      completedDays: ['LUNES'],
      serverRevision: 2,
      phase: 'generating',
    })
    expect(result.partialWeek.semana).toBe(3)
    expect(result.partialWeek.mesociclo).toBe('FUERZA')
    expect(result.partialWeek.dias[0]).toMatchObject({
      nombre: 'LUNES',
      evofuncional: 'A) Fuerza\nB) Metcon',
    })
  })

  it('restaura target y configuración sin degradar el borrador local más rico', () => {
    const result = remoteSnapshotToLocalJob(
      {
        job: {
          id: 'job-2',
          fingerprint: 'fp-remoto',
          status: 'generating',
          target: {
            mesocycle: 'FUERZA',
            week: 4,
            cycleId: 'FUERZA:2026-07-06',
          },
          configuration: {
            buildId: 'build-remoto',
            generationDays: ['LUNES'],
          },
          partialWeek: {
            semana: 4,
            dias: [
              {
                nombre: 'LUNES',
                feedback_evofuncional: '',
                wodbuster: { duracion: 45 },
              },
            ],
          },
          completedDays: ['LUNES'],
          revision: 3,
        },
        steps: [
          {
            status: 'completed',
            day: 'LUNES',
            result: {
              dia: {
                nombre: 'LUNES',
                evofuncional: 'Contenido remoto definitivo',
                feedback_evofuncional: '',
                wodbuster: { rondas: 5 },
              },
            },
          },
        ],
      },
      {
        phase: 'generating',
        target: {
          cycleStartDate: '2026-07-06',
          weekStartDate: '2026-07-27',
        },
        configuration: {
          proposalNarrative: 'Progresión local ya aceptada',
          contextSelection: { selectedWeekIds: ['week-1'] },
        },
        partialWeek: {
          titulo: 'Semana 4 · Fuerza',
          cycle_id: 'FUERZA:2026-07-06',
          metadata: { source: 'editor', version: 2 },
          dias: [
            {
              nombre: 'LUNES',
              evofuncional: 'Contenido local anterior',
              feedback_evofuncional: 'Mantener tempo',
              wodbuster: { formato: 'AMRAP' },
            },
          ],
        },
      },
    )

    expect(result.target).toEqual({
      cycleStartDate: '2026-07-06',
      weekStartDate: '2026-07-27',
      mesocycle: 'FUERZA',
      week: 4,
      cycleId: 'FUERZA:2026-07-06',
    })
    expect(result.configuration).toEqual({
      proposalNarrative: 'Progresión local ya aceptada',
      contextSelection: { selectedWeekIds: ['week-1'] },
      buildId: 'build-remoto',
      generationDays: ['LUNES'],
    })
    expect(result.partialWeek).toMatchObject({
      titulo: 'Semana 4 · Fuerza',
      cycle_id: 'FUERZA:2026-07-06',
      semana: 4,
      metadata: { source: 'editor', version: 2 },
    })
    expect(result.partialWeek.dias[0]).toEqual({
      nombre: 'LUNES',
      evofuncional: 'Contenido remoto definitivo',
      feedback_evofuncional: 'Mantener tempo',
      wodbuster: {
        formato: 'AMRAP',
        duracion: 45,
        rondas: 5,
      },
    })
  })

  it('mantiene sync_pending hasta sincronizar el borrador final y mapea cancelled', () => {
    const syncPending = remoteSnapshotToLocalJob(
      {
        job: {
          id: 'job-sync',
          status: 'ready',
          revision: 4,
          partialWeek: { semana: 2, dias: [] },
        },
        steps: [],
      },
      { phase: 'sync_pending', partialWeek: { titulo: 'Final local', dias: [] } },
    )
    expect(syncPending.phase).toBe('sync_pending')
    expect(syncPending.partialWeek.titulo).toBe('Final local')

    const cancelled = remoteSnapshotToLocalJob(
      {
        job: {
          id: 'job-cancelled',
          status: 'cancelled',
          revision: 5,
          partialWeek: { semana: 2, dias: [] },
        },
        steps: [],
      },
      { phase: 'sync_pending' },
    )
    expect(cancelled.phase).toBe('cancelled')
  })
})
