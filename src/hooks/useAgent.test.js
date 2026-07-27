import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('../lib/supabase.js', () => ({
  getCoachExerciseLibrary: vi.fn(),
  listCoachSessionFeedback: vi.fn(),
  listPublishedWeekVersionsForMesocycle: vi.fn(),
}))

import {
  contextWeeksForSynthesis,
  isCurrentAgentRequest,
  weekSessionsContextKey,
} from './useAgent.js'
import { weekContextTargetKey } from '../utils/buildWeekContext.js'

describe('useAgent async target guards', () => {
  it('acepta únicamente la respuesta de la petición activa y del target exacto', () => {
    const key = weekContextTargetKey({
      mesocycle: 'fuerza',
      week: 5,
      cycleId: 'fuerza:2026-06-29',
      cycleStartDate: '2026-06-29',
    })

    expect(isCurrentAgentRequest(7, key, 7, key)).toBe(true)
    expect(isCurrentAgentRequest(6, key, 7, key)).toBe(false)
    expect(
      isCurrentAgentRequest(
        7,
        key,
        7,
        weekContextTargetKey({
          mesocycle: 'fuerza',
          week: 6,
          cycleId: 'fuerza:2026-06-29',
          cycleStartDate: '2026-06-29',
        }),
      ),
    ).toBe(false)
    expect(
      isCurrentAgentRequest(
        7,
        key,
        7,
        weekContextTargetKey({
          mesocycle: 'fuerza',
          week: 5,
          cycleId: 'fuerza:2026-09-07',
          cycleStartDate: '2026-09-07',
        }),
      ),
    ).toBe(false)
    expect(isCurrentAgentRequest(7, key, 7, key, 'sessions-a', 'sessions-b')).toBe(
      false,
    )
  })

  it('invalida la petición si cambia una sesión confirmada y sintetiza todas las modalidades', () => {
    const before = weekSessionsContextKey({ sessions: {} })
    const after = weekSessionsContextKey({
      sessions: {
        monday: {
          confirmed: true,
          content: 'Back Squat',
          classes: ['EvoFuncional'],
        },
      },
    })
    expect(after).not.toBe(before)

    const [week] = contextWeeksForSynthesis([
      {
        id: 's4',
        semana: 4,
        data: {
          dias: [
            {
              nombre: 'Lunes',
              evohybrix: 'Sled Push',
              evofuerza: 'Strict Press',
              evogimnastica: 'Pull-up',
              evotodos: 'Carrera',
            },
          ],
        },
      },
    ])
    expect(week.dias[0].evofuncional).toContain('EvoHybrix: Sled Push')
    expect(week.dias[0].evofuncional).toContain('EvoFuerza: Strict Press')
    expect(week.dias[0].evofuncional).toContain('EvoGimnástica: Pull-up')
    expect(week.dias[0].evofuncional).toContain('EvoTodos: Carrera')
    expect(week.dias[0].evofuncional.slice(0, 120)).toContain('Hyb:')
    expect(week.dias[0].evofuncional.slice(0, 120)).toContain('Fza:')
    expect(week.dias[0].evofuncional.slice(0, 120)).toContain('Gim:')
    expect(week.dias[0].evofuncional.slice(0, 120)).toContain('Todos:')
  })

  it('espera el snapshot, reinicia el chat por target y no consulta históricos por rutas laterales', () => {
    const source = readFileSync(new URL('./useAgent.js', import.meta.url), 'utf8')
    const awaitContextAt = source.indexOf(
      'const loadedContext = await pendingContext.promise',
    )
    const fetchAt = source.indexOf("fetch('/api/anthropic'")

    expect(awaitContextAt).toBeGreaterThan(0)
    expect(fetchAt).toBeGreaterThan(awaitContextAt)
    expect(source).toContain('messagesRef.current = []')
    expect(source).toContain('setMessages([])')
    expect(source).toContain('}, [targetKey])')
    expect(source).not.toContain(".from('published_weeks')")
    expect(source).not.toContain(".from('coach_session_feedback')")
    expect(source).not.toContain('getReferenceMesocycleContextForLLM')
  })

  it('envía el snapshot semanal una sola vez mediante weekContext', () => {
    const source = readFileSync(new URL('./useAgent.js', import.meta.url), 'utf8')

    expect(source).toContain('weekContext: weekCtx ||')
    expect(source).not.toContain('CONTEXTO ACTUAL')
    expect(source).not.toMatch(/systemWithContext\s*\+=\s*`[^`]*\$\{weekCtx\}/)
  })

  it('mantiene la biblioteca en fail-closed si no carga', () => {
    const source = readFileSync(new URL('./useAgent.js', import.meta.url), 'utf8')
    const catchAt = source.indexOf('.catch((libraryError)')
    const nextEffectAt = source.indexOf('useEffect(() => {', catchAt + 1)
    const catchBlock = source.slice(catchAt, nextEffectAt)

    expect(catchBlock).toContain('libraryReadyRef.current = false')
    expect(catchBlock).toContain('setLibraryReady(false)')
    expect(catchBlock).not.toContain('setLibraryReady(true)')
    expect(source).toContain("rows.length === 0")
  })
})
