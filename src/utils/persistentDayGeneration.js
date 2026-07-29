export class PersistentGenerationCancelledError extends Error {
  constructor() {
    super('La generación fue cancelada.')
    this.name = 'PersistentGenerationCancelledError'
    this.code = 'generation_cancelled'
  }
}

function uniqueDays(days) {
  return [
    ...new Set(
      (Array.isArray(days) ? days : [])
        .map((day) => String(day || '').trim())
        .filter(Boolean),
    ),
  ]
}

/**
 * Orquesta una semana sin reintentos ocultos.
 *
 * Un día no se considera completado ni se inicia el siguiente hasta que
 * `persistDay` haya terminado. Una caída deja como máximo un día pendiente y
 * nunca repite los días que ya constan como guardados.
 */
export async function runPersistentDayGeneration({
  days,
  completedDays = [],
  generateDay,
  persistDay,
  onProgress,
  signal,
}) {
  if (typeof generateDay !== 'function' || typeof persistDay !== 'function') {
    throw new TypeError('generateDay y persistDay son obligatorios.')
  }
  const orderedDays = uniqueDays(days)
  const completed = new Set(uniqueDays(completedDays))
  const pending = orderedDays.filter((day) => !completed.has(day))
  const results = []

  for (let index = 0; index < pending.length; index += 1) {
    if (signal?.aborted) throw new PersistentGenerationCancelledError()
    const day = pending[index]
    onProgress?.({
      phase: 'generating',
      day,
      index,
      total: pending.length,
      completedDays: [...completed],
    })

    const result = await generateDay(day, {
      index,
      total: pending.length,
      completedDays: [...completed],
      signal,
    })
    if (signal?.aborted) throw new PersistentGenerationCancelledError()

    const nextCompletedDays = [...completed, day]
    await persistDay({
      day,
      result,
      index,
      total: pending.length,
      completedDays: nextCompletedDays,
    })
    completed.add(day)
    results.push({ day, result })
    onProgress?.({
      phase: 'saved',
      day,
      index,
      total: pending.length,
      completedDays: [...completed],
    })
  }

  return {
    completedDays: [...completed],
    pendingDays: orderedDays.filter((day) => !completed.has(day)),
    results,
  }
}
