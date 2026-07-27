export function publicationMutationSnapshotIsCurrent({
  capturedRevision,
  currentRevision,
  capturedTargetIdentity,
  currentTargetIdentity,
  capturedFingerprint,
  currentFingerprint,
}) {
  return (
    Number(capturedRevision) === Number(currentRevision) &&
    String(capturedTargetIdentity || '') === String(currentTargetIdentity || '') &&
    String(capturedFingerprint || '') === String(currentFingerprint || '')
  )
}

export function publicationMutationTargetIsCurrent({
  capturedTargetIdentity,
  currentTargetIdentity,
}) {
  return String(capturedTargetIdentity || '') === String(currentTargetIdentity || '')
}
