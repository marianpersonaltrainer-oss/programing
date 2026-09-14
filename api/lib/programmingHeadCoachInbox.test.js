import { describe, expect, it } from 'vitest'
import {
  appendProgrammingHeadCoachPrompt,
  buildProgrammingHeadCoachPrompt,
  normalizeProgrammingHeadCoachInbox,
} from './programmingHeadCoachInbox.js'

const packet = {
  source: 'head_coach_to_programming_agent',
  status: 'review_required',
  week_start_date: '2026-09-14',
  period: { start: '2026-09-07', end: '2026-09-11' },
  feedback: {
    feedback_total: 16,
    changed_total: 5,
    notes_next_week_total: 2,
    changes_by_class: [
      { class_label: 'EvoFuncional', feedback_count: 8, changed_count: 3 },
    ],
  },
  review_items: [
    {
      type: 'many_programming_changes_review',
      source: 'trainer_feedback',
      count: 1,
      priority: 'normal',
    },
  ],
  wodbuster_reconciliation: {
    status: 'coverage_observed',
    unexpected_observed_modality_count: 0,
  },
  automatic_programming_changes: false,
  automatic_publication: false,
  external_actions: false,
  coach_name: 'esto nunca se conserva',
  comments: 'ni el texto libre se conserva',
}

describe('programmingHeadCoachInbox', () => {
  it('normaliza exclusivamente el contrato agregado permitido', () => {
    const result = normalizeProgrammingHeadCoachInbox(packet)
    expect(result).not.toHaveProperty('coach_name')
    expect(result).not.toHaveProperty('comments')
    expect(result.feedback.changed_total).toBe(5)
  })

  it('bloquea cualquier intento de automatizar cambios o publicación', () => {
    expect(() => normalizeProgrammingHeadCoachInbox({
      ...packet,
      automatic_publication: true,
    })).toThrow('unsafe_automation_flags')
  })

  it('convierte el paquete en una revisión humana y no una orden', () => {
    const prompt = buildProgrammingHeadCoachPrompt(packet)
    expect(prompt).toContain('No apliques cambios, no publiques')
    expect(prompt).toContain('EvoFuncional: 3/8')
    expect(prompt).not.toContain('esto nunca se conserva')
    expect(appendProgrammingHeadCoachPrompt('BASE', prompt)).toContain('BASE')
  })
})
