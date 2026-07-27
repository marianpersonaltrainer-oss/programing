import { describe, expect, it } from 'vitest'
import {
  publicationMutationSnapshotIsCurrent,
  publicationMutationTargetIsCurrent,
} from './publicationMutationSnapshot.js'

const base = {
  capturedRevision: 4,
  currentRevision: 4,
  capturedTargetIdentity: 'fuerza:s5:2026-06-29',
  currentTargetIdentity: 'fuerza:s5:2026-06-29',
  capturedFingerprint: 'fp-current',
  currentFingerprint: 'fp-current',
}

describe('publicationMutationSnapshotIsCurrent', () => {
  it('acepta únicamente la misma edición, objetivo y huella', () => {
    expect(publicationMutationSnapshotIsCurrent(base)).toBe(true)
    expect(
      publicationMutationSnapshotIsCurrent({ ...base, currentRevision: 5 }),
    ).toBe(false)
    expect(
      publicationMutationSnapshotIsCurrent({
        ...base,
        currentTargetIdentity: 'fuerza:s5:2026-09-07',
      }),
    ).toBe(false)
    expect(
      publicationMutationSnapshotIsCurrent({
        ...base,
        currentFingerprint: 'fp-edited',
      }),
    ).toBe(false)
  })

  it('permite adoptar CAS tras editar contenido, pero no tras cambiar de ciclo', () => {
    expect(
      publicationMutationTargetIsCurrent({
        ...base,
        currentRevision: 99,
        currentFingerprint: 'otro-contenido',
      }),
    ).toBe(true)
    expect(
      publicationMutationTargetIsCurrent({
        ...base,
        currentTargetIdentity: 'fuerza:s5:2026-09-07',
      }),
    ).toBe(false)
  })
})
