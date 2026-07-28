import { describe, expect, it } from 'vitest'
import {
  BRIEFING_PROPOSAL_CLIENT_TIMEOUT_MS,
  BRIEFING_RETRY_MIN_REMAINING_MS,
  BRIEFING_UPSTREAM_CALL_MS,
  canRetryBriefingAnthropic,
} from './briefingTimeBudget.js'

describe('briefingTimeBudget', () => {
  it('alinea cliente con hasta dos llamadas upstream', () => {
    expect(BRIEFING_PROPOSAL_CLIENT_TIMEOUT_MS).toBeGreaterThanOrEqual(
      BRIEFING_UPSTREAM_CALL_MS * 2,
    )
  })

  it('no permite retry si no queda margen', () => {
    const start = Date.now()
    expect(canRetryBriefingAnthropic(start, start + 90_000)).toBe(false)
    expect(canRetryBriefingAnthropic(start, start + 10_000)).toBe(true)
    expect(BRIEFING_RETRY_MIN_REMAINING_MS).toBeGreaterThan(BRIEFING_UPSTREAM_CALL_MS)
  })
})
