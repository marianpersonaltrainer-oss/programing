import { describe, expect, it, vi } from 'vitest'
import {
  finalizeGenerationJob,
  findGenerationJobByTarget,
} from './programmingGenerationJobs.js'

function queryResult(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    contains: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  }
  return query
}

describe('findGenerationJobByTarget', () => {
  it('busca el job más reciente por mesociclo, semana e identidad estable', async () => {
    const row = {
      id: 'job-target',
      idempotency_key: 'idem-target',
      fingerprint: 'fingerprint-antiguo',
      status: 'generating',
      target: {
        mesocycle: 'FUERZA',
        week: 3,
        cycleId: 'FUERZA:2026-07-13',
        weekStartDate: '2026-07-27',
      },
      configuration: {
        proposalNarrative: 'Progresión recuperable',
        weeklyOffer: { dias: { LUNES: ['evofuncional'] } },
      },
      completed_days: ['LUNES'],
      revision: 2,
    }
    const searchQuery = queryResult({ data: row, error: null })
    const snapshotQuery = queryResult({ data: row, error: null })
    const stepsQuery = {
      select: vi.fn(() => stepsQuery),
      eq: vi.fn(() => stepsQuery),
      order: vi.fn(async () => ({
        data: [
          {
            job_id: row.id,
            day_key: 'LUNES',
            status: 'completed',
            attempt_count: 1,
          },
        ],
        error: null,
      })),
    }
    let jobsQueryCount = 0
    const supabase = {
      from: vi.fn((table) => {
        if (table === 'programming_generation_steps') return stepsQuery
        jobsQueryCount += 1
        return jobsQueryCount === 1 ? searchQuery : snapshotQuery
      }),
    }

    const result = await findGenerationJobByTarget(supabase, {
      mesociclo: 'FUERZA',
      semana: 3,
      cycle_id: 'FUERZA:2026-07-13',
      week_start_date: '2026-07-27',
    })

    expect(searchQuery.contains).toHaveBeenCalledWith('target', {
      mesocycle: 'FUERZA',
      week: 3,
      cycleId: 'FUERZA:2026-07-13',
      weekStartDate: '2026-07-27',
    })
    expect(searchQuery.in).toHaveBeenCalledWith('status', [
      'queued',
      'preparing',
      'generating',
      'failed',
      'ready',
    ])
    expect(searchQuery.order).toHaveBeenCalledWith('updated_at', {
      ascending: false,
    })
    expect(result).toMatchObject({
      job: {
        id: 'job-target',
        target: row.target,
        configuration: row.configuration,
        completedDays: ['LUNES'],
      },
      steps: [{ day: 'LUNES', status: 'completed' }],
    })
  })

  it.each([
    [{ week: 3, cycleId: 'cycle-1' }],
    [{ mesocycle: 'FUERZA', cycleId: 'cycle-1' }],
    [{ mesocycle: 'FUERZA', week: 3 }],
    [{ mesocycle: 'FUERZA', week: 0, weekStartDate: '2026-07-27' }],
  ])('rechaza target ambiguo antes de consultar la base de datos: %o', async (target) => {
    const supabase = { from: vi.fn() }
    await expect(findGenerationJobByTarget(supabase, target)).rejects.toMatchObject({
      code: 'invalid_generation_job_target',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

function finalizeSupabase({ rpcData = null, rpcError = null, row = null } = {}) {
  const readyRow = row || rpcData?.job || {
    id: 'job-final',
    idempotency_key: 'idem-final',
    fingerprint: 'fp-final',
    status: 'ready',
    target: { mesocycle: 'FUERZA', week: 3 },
    configuration: { generationDays: ['LUNES'] },
    current_day: null,
    completed_days: ['LUNES'],
    partial_week: { titulo: 'Semana final', dias: [{ nombre: 'LUNES' }] },
    revision: 4,
  }
  const jobQuery = queryResult({ data: readyRow, error: null })
  const stepsQuery = {
    select: vi.fn(() => stepsQuery),
    eq: vi.fn(() => stepsQuery),
    order: vi.fn(async () => ({
      data: [
        {
          job_id: readyRow.id,
          day_key: 'LUNES',
          status: 'completed',
          attempt_count: 1,
          result: { dia: { nombre: 'LUNES' } },
        },
      ],
      error: null,
    })),
  }
  return {
    rpc: vi.fn(async () => ({ data: rpcData, error: rpcError })),
    from: vi.fn((table) =>
      table === 'programming_generation_steps' ? stepsQuery : jobQuery),
  }
}

describe('finalizeGenerationJob', () => {
  it('devuelve el snapshot ready confirmado por la RPC', async () => {
    const rpcJob = {
      id: 'job-final',
      status: 'ready',
      revision: 4,
    }
    const supabase = finalizeSupabase({
      rpcData: {
        finalized: true,
        idempotent: false,
        job: rpcJob,
      },
    })
    const partialWeek = {
      titulo: 'Semana final',
      dias: [{ nombre: 'LUNES' }],
    }

    const result = await finalizeGenerationJob(supabase, {
      jobId: 'job-final',
      expectedRevision: 3,
      partialWeek,
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      'finalize_programming_generation_job',
      {
        p_job_id: 'job-final',
        p_expected_revision: 3,
        p_partial_week: partialWeek,
      },
    )
    expect(result).toMatchObject({
      job: { id: 'job-final', status: 'ready', revision: 4 },
      finalization: { finalized: true, idempotent: false },
    })
  })

  it('acepta como éxito seguro un retry ready idéntico', async () => {
    const supabase = finalizeSupabase({
      rpcData: {
        finalized: true,
        idempotent: true,
        job: { id: 'job-final', status: 'ready', revision: 4 },
      },
    })

    const result = await finalizeGenerationJob(supabase, {
      jobId: 'job-final',
      expectedRevision: 3,
      partialWeek: {
        titulo: 'Semana final',
        dias: [{ nombre: 'LUNES' }],
      },
    })

    expect(result.finalization).toEqual({
      finalized: true,
      idempotent: true,
    })
  })

  it.each([
    'generation_job_incomplete',
    'generation_job_revision_conflict',
  ])('conserva el código autoritativo de la RPC: %s', async (code) => {
    const supabase = finalizeSupabase({
      rpcError: {
        code: 'P0001',
        message: code,
        details: 'La RPC rechazó la finalización.',
      },
    })

    await expect(
      finalizeGenerationJob(supabase, {
        jobId: 'job-final',
        expectedRevision: 3,
        partialWeek: { titulo: 'Semana', dias: [] },
      }),
    ).rejects.toMatchObject({ code, message: code })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
