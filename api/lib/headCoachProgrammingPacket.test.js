import { describe, expect, it } from 'vitest'
import { buildHeadCoachProgrammingPacket } from './headCoachProgrammingPacket.js'

const atlasSummary = {
  period: { start: '2026-09-07', end: '2026-09-14' },
  feedback_total: 6,
  changed_total: 2,
  notes_next_week_total: 1,
  changes_by_class: [
    { class_label: 'EvoFit', feedback_count: 6, changed_count: 2 },
  ],
  many_changes: { triggered: true, weeks: [{ week_start_date: '2026-09-07' }] },
  sensitive_review_total: 4,
  raw_text_returned: false,
}

describe('Head Coach → agente programador packet', () => {
  it('convierte solo agregados permitidos y mantiene la revisión humana', () => {
    const packet = buildHeadCoachProgrammingPacket({
      weekStartDate: '2026-09-14',
      atlasSummary,
      wodbusterReconciliation: {
        status: 'coverage_observed',
        unexpected_observed_modality_count: 0,
      },
    })

    expect(packet).toMatchObject({
      status: 'review_required',
      automatic_programming_changes: false,
      automatic_publication: false,
      external_actions: false,
      review_items: [expect.objectContaining({ type: 'many_programming_changes_review' })],
    })
    expect(JSON.stringify(packet)).not.toContain('sensitive_review_total')
    expect(JSON.stringify(packet)).not.toContain('raw_text_returned')
  })

  it('solo eleva una discrepancia WodBuster explícita y categórica', () => {
    const packet = buildHeadCoachProgrammingPacket({
      weekStartDate: '2026-09-14',
      atlasSummary: { ...atlasSummary, many_changes: { triggered: false, weeks: [] } },
      wodbusterReconciliation: {
        status: 'review_required',
        unexpected_observed_modality_count: 2,
      },
    })

    expect(packet.review_items).toEqual([
      expect.objectContaining({
        type: 'programming_wodbuster_unexpected_modality_review',
        priority: 'high',
      }),
    ])
  })

  it('falla cerrado si falta una comprobación WodBuster explícita', () => {
    expect(() => buildHeadCoachProgrammingPacket({
      weekStartDate: '2026-09-14',
      atlasSummary,
    })).toThrow('invalid_wodbuster_reconciliation')
  })
})
