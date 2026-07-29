import { describe, expect, it, vi } from 'vitest'
import {
  PersistentGenerationCancelledError,
  runPersistentDayGeneration,
} from './persistentDayGeneration.js'

describe('runPersistentDayGeneration', () => {
  it('guarda cada día antes de iniciar el siguiente', async () => {
    const order = []
    const result = await runPersistentDayGeneration({
      days: ['LUNES', 'MARTES', 'MIÉRCOLES'],
      generateDay: async (day) => {
        order.push(`generate:${day}`)
        return { dia: day }
      },
      persistDay: async ({ day, completedDays }) => {
        order.push(`persist:${day}:${completedDays.join(',')}`)
      },
    })

    expect(order).toEqual([
      'generate:LUNES',
      'persist:LUNES:LUNES',
      'generate:MARTES',
      'persist:MARTES:LUNES,MARTES',
      'generate:MIÉRCOLES',
      'persist:MIÉRCOLES:LUNES,MARTES,MIÉRCOLES',
    ])
    expect(result.completedDays).toEqual(['LUNES', 'MARTES', 'MIÉRCOLES'])
  })

  it('reanuda desde el primer día pendiente sin duplicar los guardados', async () => {
    const generateDay = vi.fn(async (day) => ({ dia: day }))
    const persistDay = vi.fn(async () => {})

    await runPersistentDayGeneration({
      days: ['LUNES', 'MARTES', 'MIÉRCOLES'],
      completedDays: ['LUNES', 'MARTES', 'LUNES'],
      generateDay,
      persistDay,
    })

    expect(generateDay).toHaveBeenCalledTimes(1)
    expect(generateDay).toHaveBeenCalledWith(
      'MIÉRCOLES',
      expect.objectContaining({ completedDays: ['LUNES', 'MARTES'] }),
    )
    expect(persistDay).toHaveBeenCalledTimes(1)
  })

  it('se detiene en el día fallido y no empieza días posteriores', async () => {
    const generateDay = vi.fn(async (day) => {
      if (day === 'MARTES') throw new Error('upstream_timeout')
      return { dia: day }
    })
    const persistDay = vi.fn(async () => {})

    await expect(
      runPersistentDayGeneration({
        days: ['LUNES', 'MARTES', 'MIÉRCOLES'],
        generateDay,
        persistDay,
      }),
    ).rejects.toThrow('upstream_timeout')

    expect(generateDay.mock.calls.map(([day]) => day)).toEqual(['LUNES', 'MARTES'])
    expect(persistDay.mock.calls.map(([value]) => value.day)).toEqual(['LUNES'])
  })

  it('no empieza el siguiente día si falla la persistencia', async () => {
    const generateDay = vi.fn(async (day) => ({ dia: day }))
    const persistDay = vi.fn(async () => {
      throw new Error('database unavailable')
    })

    await expect(
      runPersistentDayGeneration({
        days: ['LUNES', 'MARTES'],
        generateDay,
        persistDay,
      }),
    ).rejects.toThrow('database unavailable')

    expect(generateDay).toHaveBeenCalledTimes(1)
  })

  it('respeta una cancelación antes de la siguiente operación', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      runPersistentDayGeneration({
        days: ['LUNES'],
        generateDay: vi.fn(),
        persistDay: vi.fn(),
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(PersistentGenerationCancelledError)
  })
})
