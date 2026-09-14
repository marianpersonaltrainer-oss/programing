import { expect, it, vi } from 'vitest'
import { createAtlasFeedbackSummary } from './atlas-feedback-summary.js'
import { feedbackPeriod, summarizeAtlasFeedback } from './lib/atlasFeedbackSummary.js'

function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }
}

it('summarizes changes without returning names or free text', () => {
  const summary = summarizeAtlasFeedback({
    start: '2026-08-31', end: '2026-09-07',
    weekRows: [
      { id: 'w1', week_start_date: '2026-08-31' },
      { id: 'w2', week_start_date: '2026-09-07' },
    ],
    feedbackRows: [
      { week_id: 'w1', coach_name: 'PRIVATE NAME', class_label: 'EvoFit',
        session_how: 'regular', time_for_explanation: 'justo', changed_something: true,
        changed_details: 'PRIVATE DETAIL', notes_next_week: 'PRIVATE NOTE' },
      { week_id: 'w2', class_label: 'EvoFit', session_how: 'bien',
        time_for_explanation: 'si', changed_something: false,
        group_feelings: 'Una persona tuvo dolor' },
    ],
  })
  expect(summary).toMatchObject({
    feedback_total: 2, changed_total: 1, change_rate_pct: 50,
    low_rating_total: 1, timing_tight_total: 1, notes_next_week_total: 1,
    sensitive_review_total: 1, raw_text_returned: false, coach_names_returned: false,
  })
  expect(summary.changes_by_class).toEqual([
    { class_label: 'EvoFit', feedback_count: 2, changed_count: 1 },
  ])
  expect(summary).toMatchObject({
    alert_thresholds: {
      many_changes: { min_feedback: 5, min_change_rate_pct: 30, scope: 'per_week' },
    },
    many_changes: { triggered: false, weeks: [] },
  })
  expect(JSON.stringify(summary)).not.toContain('PRIVATE')
  expect(JSON.stringify(summary)).not.toContain('dolor')
})

it('returns only a bounded aggregate contract for a high-change week', () => {
  const feedbackRows = Array.from({ length: 5 }, (_, index) => ({
    week_id: 'w', class_label: 'EvoFit', changed_something: index < 2,
  }))
  const summary = summarizeAtlasFeedback({
    start: '2026-09-07', end: '2026-09-07',
    weekRows: [{ id: 'w', week_start_date: '2026-09-07' }],
    feedbackRows,
  })
  expect(summary.many_changes).toEqual({
    triggered: true,
    weeks: [{ week_start_date: '2026-09-07', feedback_count: 5, changed_count: 2, change_rate_pct: 40 }],
  })
  expect(JSON.stringify(summary)).not.toContain('changed_details')
})

it('uses a bounded Madrid calendar-week window', () => {
  expect(feedbackPeriod(new Date('2026-09-13T20:00:00Z'), 6))
    .toEqual({ start: '2026-08-03', end: '2026-09-07' })
  expect(() => feedbackPeriod(new Date(), 9)).toThrow('invalid_weeks')
})

it('rejects unauthenticated calls before loading data', async () => {
  const load = vi.fn()
  const res = response()
  await createAtlasFeedbackSummary({ env: {
    ATLAS_FEEDBACK_READ_SECRET: 'secret', SUPABASE_URL: 'url', SUPABASE_SERVICE_ROLE_KEY: 'key',
  }, load })({ method: 'POST', headers: {}, body: {} }, res)
  expect(res.status).toHaveBeenCalledWith(401)
  expect(load).not.toHaveBeenCalled()
})

it('returns only the reduced summary for an authenticated call', async () => {
  const load = vi.fn().mockResolvedValue({
    weekRows: [{ id: 'w', week_start_date: '2026-09-07' }],
    feedbackRows: [{ week_id: 'w', coach_name: 'PRIVATE', class_label: 'EvoBasics',
      changed_something: true, changed_details: 'PRIVATE CHANGE' }],
  })
  const res = response()
  await createAtlasFeedbackSummary({
    env: { ATLAS_FEEDBACK_READ_SECRET: 'secret', SUPABASE_URL: 'url', SUPABASE_SERVICE_ROLE_KEY: 'key' },
    now: () => new Date('2026-09-13T20:00:00Z'), load,
    createClientImpl: vi.fn().mockReturnValue({}),
    rateLimit: vi.fn().mockResolvedValue(false),
  })({ method: 'POST', headers: { 'x-atlas-feedback-secret': 'secret' }, body: { weeks: 1 } }, res)
  expect(res.status).toHaveBeenCalledWith(200)
  const payload = res.json.mock.calls[0][0]
  expect(payload.summary.feedback_total).toBe(1)
  expect(JSON.stringify(payload)).not.toContain('PRIVATE')
})

it('fails closed when the shared rate limit cannot be checked', async () => {
  const res = response()
  await createAtlasFeedbackSummary({
    env: { ATLAS_FEEDBACK_READ_SECRET: 'secret', SUPABASE_URL: 'url', SUPABASE_SERVICE_ROLE_KEY: 'key' },
    createClientImpl: vi.fn().mockReturnValue({}),
    load: vi.fn().mockResolvedValue({ weekRows: [], feedbackRows: [] }),
    rateLimit: vi.fn().mockRejectedValue(new Error('down')),
  })({ method: 'POST', headers: { 'x-atlas-feedback-secret': 'secret' }, body: {} }, res)
  expect(res.status).toHaveBeenCalledWith(503)
})

it('checks the rate limit before reading feedback', async () => {
  const load = vi.fn()
  const res = response()
  await createAtlasFeedbackSummary({
    env: { ATLAS_FEEDBACK_READ_SECRET: 'secret', SUPABASE_URL: 'url', SUPABASE_SERVICE_ROLE_KEY: 'key' },
    createClientImpl: vi.fn().mockReturnValue({}),
    load,
    rateLimit: vi.fn().mockResolvedValue(true),
  })({ method: 'POST', headers: { 'x-atlas-feedback-secret': 'secret' }, body: {} }, res)
  expect(res.status).toHaveBeenCalledWith(429)
  expect(load).not.toHaveBeenCalled()
})

it('accepts a JSON string body and rejects malformed JSON', async () => {
  const base = {
    env: { ATLAS_FEEDBACK_READ_SECRET: 'secret', SUPABASE_URL: 'url', SUPABASE_SERVICE_ROLE_KEY: 'key' },
    createClientImpl: vi.fn().mockReturnValue({}),
    rateLimit: vi.fn().mockResolvedValue(false),
    load: vi.fn().mockResolvedValue({ weekRows: [], feedbackRows: [] }),
  }
  const ok = response()
  await createAtlasFeedbackSummary(base)({
    method: 'POST', headers: { 'x-atlas-feedback-secret': 'secret' }, body: '{"weeks":2}',
  }, ok)
  expect(ok.status).toHaveBeenCalledWith(200)

  const bad = response()
  await createAtlasFeedbackSummary(base)({
    method: 'POST', headers: { 'x-atlas-feedback-secret': 'secret' }, body: '{',
  }, bad)
  expect(bad.status).toHaveBeenCalledWith(400)
})
