/** Comprueba optimistic locking de pe2_weeks antes/después de un update. */
export function assertPe2WeekLockMatch(row, expectedLockVersion) {
  if (expectedLockVersion == null) return { ok: true, row }
  if (!row) {
    return {
      ok: false,
      code: 'PE2-LOCK-001',
      message:
        'No se pudo guardar: otra pestaña o sesión publicó una versión más reciente de este borrador. Recarga y vuelve a editar.',
    }
  }
  if (Number(row.lock_version) !== Number(expectedLockVersion)) {
    return {
      ok: false,
      code: 'PE2-LOCK-001',
      message: `Conflicto de versión (esperada ${expectedLockVersion}, actual ${row.lock_version}). Recarga la semana antes de guardar o publicar.`,
    }
  }
  return { ok: true, row }
}

export class Pe2WeekVersionConflictError extends Error {
  constructor(message, code = 'PE2-LOCK-001') {
    super(message)
    this.name = 'Pe2WeekVersionConflictError'
    this.code = code
  }
}
