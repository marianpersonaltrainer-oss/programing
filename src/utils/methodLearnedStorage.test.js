import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  METHOD_LEARNED_KEY,
  loadLearnedState,
} from './methodLearnedStorage.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}

describe('migración de decisiones del método aprendido', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage()
  })

  afterEach(() => {
    delete globalThis.localStorage
  })

  it('conserva decisiones 1.2 como propuestas pendientes, fuera de manual confirmado', () => {
    localStorage.setItem(
      'programingevo_method_learned_v1_2_0',
      JSON.stringify({
        manual: 'Usar una pausa concreta que debe volver a revisarse.',
        auto: [
          {
            id: 'auto-old',
            at: '2026-07-01T10:00:00.000Z',
            text: 'Observación antigua pendiente.',
          },
        ],
      }),
    )

    const migrated = loadLearnedState()

    expect(migrated.manual).toBe('')
    expect(migrated.auto.map((entry) => entry.text)).toEqual([
      expect.stringContaining('Usar una pausa concreta'),
      'Observación antigua pendiente.',
    ])
    expect(JSON.parse(localStorage.getItem(METHOD_LEARNED_KEY))).toEqual(migrated)
  })

  it('no degrada las decisiones ya confirmadas en la versión actual', () => {
    localStorage.setItem(
      METHOD_LEARNED_KEY,
      JSON.stringify({ manual: 'Decisión 1.3 confirmada.', auto: [] }),
    )

    expect(loadLearnedState()).toEqual({
      manual: 'Decisión 1.3 confirmada.',
      auto: [],
    })
  })
})
