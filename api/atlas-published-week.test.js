import { expect, it, vi } from 'vitest'
import { createAtlasPublishedWeek } from './atlas-published-week.js'

function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }
}

const env = {
  ATLAS_PROGRAMMING_READ_SECRET: 'private-programming-secret',
  SUPABASE_URL: 'url',
  SUPABASE_SERVICE_ROLE_KEY: 'key',
}

it('rejects unauthenticated requests before loading a week', async () => {
  const load = vi.fn()
  const res = response()
  await createAtlasPublishedWeek({ env, load })({ method: 'POST', headers: {}, body: {} }, res)
  expect(res.status).toHaveBeenCalledWith(401)
  expect(load).not.toHaveBeenCalled()
})

it('requires an exact Monday date', async () => {
  const load = vi.fn()
  const res = response()
  await createAtlasPublishedWeek({ env, load })({
    method: 'POST', headers: { 'x-atlas-programming-secret': env.ATLAS_PROGRAMMING_READ_SECRET },
    body: { week_start_date: '2026-09-08' },
  }, res)
  expect(res.status).toHaveBeenCalledWith(400)
  expect(load).not.toHaveBeenCalled()
})

it('returns just one published week to the authenticated Atlas reader', async () => {
  const week = {
    week_start_date: '2026-09-07', mesociclo: 'Autocarga', semana: 5,
    titulo: 'S5', published_at: '2026-09-06T10:00:00.000Z', data: { dias: [] },
  }
  const load = vi.fn().mockResolvedValue(week)
  const res = response()
  await createAtlasPublishedWeek({
    env, load, createClientImpl: vi.fn().mockReturnValue({}), rateLimit: vi.fn().mockResolvedValue(false),
  })({
    method: 'POST', headers: { 'x-atlas-programming-secret': env.ATLAS_PROGRAMMING_READ_SECRET },
    body: JSON.stringify({ week_start_date: '2026-09-07' }),
  }, res)
  expect(res.status).toHaveBeenCalledWith(200)
  expect(res.json).toHaveBeenCalledWith({ ok: true, week })
  expect(load).toHaveBeenCalledWith(expect.objectContaining({ weekStartDate: '2026-09-07', activeOnly: false }))
})

it('can read exactly one current published week without guessing its date', async () => {
  const load = vi.fn().mockResolvedValue({ week_start_date: '2026-09-14', data: { dias: [] } })
  const res = response()
  await createAtlasPublishedWeek({
    env, load, createClientImpl: vi.fn().mockReturnValue({}), rateLimit: vi.fn().mockResolvedValue(false),
  })({
    method: 'POST', headers: { 'x-atlas-programming-secret': env.ATLAS_PROGRAMMING_READ_SECRET },
    body: { selection: 'active' },
  }, res)
  expect(res.status).toHaveBeenCalledWith(200)
  expect(load).toHaveBeenCalledWith(expect.objectContaining({ weekStartDate: '', activeOnly: true }))
})

it('does not choose between multiple or absent weeks', async () => {
  const res = response()
  await createAtlasPublishedWeek({
    env,
    load: vi.fn().mockRejectedValue(new Error('week_not_found_or_ambiguous')),
    createClientImpl: vi.fn().mockReturnValue({}), rateLimit: vi.fn().mockResolvedValue(false),
  })({
    method: 'POST', headers: { 'x-atlas-programming-secret': env.ATLAS_PROGRAMMING_READ_SECRET },
    body: { week_start_date: '2026-09-07' },
  }, res)
  expect(res.status).toHaveBeenCalledWith(404)
})

it('never returns an unbounded weekly payload', async () => {
  const res = response()
  await createAtlasPublishedWeek({
    env,
    load: vi.fn().mockResolvedValue({ data: 'x'.repeat(256_001) }),
    createClientImpl: vi.fn().mockReturnValue({}), rateLimit: vi.fn().mockResolvedValue(false),
  })({
    method: 'POST', headers: { 'x-atlas-programming-secret': env.ATLAS_PROGRAMMING_READ_SECRET },
    body: { week_start_date: '2026-09-07' },
  }, res)
  expect(res.status).toHaveBeenCalledWith(413)
})
