import { describe, expect, it } from 'vitest'
import {
  assertPublicationGateApproved,
  buildPublicationQualityGate,
  buildPublicationTargetFingerprint,
  hashPublicationValue,
  publicationGateIsApproved,
  stablePublicationJson,
} from './publicationQualityGate.js'

const approvedEvaluation = {
  scoreDisplay: 91,
  validationOutcome: { key: 'aprobado', label: 'APROBADO' },
  blockingReasons: [],
  pendingCorrections: [],
  alerts: [],
}

describe('publicationQualityGate', () => {
  it('creates the same fingerprint for objects with different key order', () => {
    expect(stablePublicationJson({ b: 2, a: { y: 2, x: 1 } })).toBe(
      stablePublicationJson({ a: { x: 1, y: 2 }, b: 2 }),
    )
    expect(hashPublicationValue({ b: 2, a: 1 })).toBe(hashPublicationValue({ a: 1, b: 2 }))
  })

  it('binds the evaluation to content, target, offer and context', () => {
    const base = {
      weekData: { titulo: 'S5', dias: [{ nombre: 'LUNES', evofuncional: 'A. Fuerza' }] },
      mesocycle: 'fuerza',
      week: 5,
      phase: 'pico',
      offer: { LUNES: ['evofuncional'] },
      contextFingerprint: 'history-v3',
      methodVersion: '1.3.0',
    }
    const fp = buildPublicationTargetFingerprint(base)
    expect(buildPublicationTargetFingerprint(base)).toBe(fp)
    expect(buildPublicationTargetFingerprint({ ...base, week: 6 })).not.toBe(fp)
    expect(
      buildPublicationTargetFingerprint({
        ...base,
        weekData: { ...base.weekData, titulo: 'S5 editada' },
      }),
    ).not.toBe(fp)
    expect(buildPublicationTargetFingerprint({ ...base, contextFingerprint: 'history-v4' })).not.toBe(fp)
  })

  it('approves only an exact current evaluation with no other gates pending', () => {
    const fingerprint = 'fp1-current'
    const gate = buildPublicationQualityGate({
      evaluation: approvedEvaluation,
      evaluationFingerprint: fingerprint,
      targetFingerprint: fingerprint,
    })
    expect(publicationGateIsApproved(gate)).toBe(true)
    expect(assertPublicationGateApproved(gate)).toBe(gate)
  })

  it.each([
    ['low score', { evaluation: { ...approvedEvaluation, scoreDisplay: 79 } }],
    [
      'review state',
      {
        evaluation: {
          ...approvedEvaluation,
          validationOutcome: { key: 'revision_necesaria' },
          pendingCorrections: ['Intervalos consecutivos'],
        },
      },
    ],
    ['approved with alerts', { evaluation: { ...approvedEvaluation, alerts: ['Material justo'] } }],
    ['stale fingerprint', { evaluationFingerprint: 'fp1-old' }],
    ['invalid method', { methodErrors: ['Descanso excesivo'] }],
    ['stale feedback', { staleFeedbackKeys: ['0::feedback_funcional'] }],
    ['missing offer', { offerPendingDays: ['MIÉRCOLES'] }],
    ['context loading', { contextReady: false }],
  ])('blocks %s', (_label, override) => {
    const gate = buildPublicationQualityGate({
      evaluation: approvedEvaluation,
      evaluationFingerprint: 'fp1-current',
      targetFingerprint: 'fp1-current',
      ...override,
    })
    expect(publicationGateIsApproved(gate)).toBe(false)
    expect(() => assertPublicationGateApproved(gate)).toThrow(/Publicación bloqueada/)
  })
})
