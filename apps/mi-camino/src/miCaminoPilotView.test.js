import { describe, expect, it } from 'vitest'
import {
  projectionActionStatusLabel,
  projectionDataStatusLabel,
  projectionProgressPercent,
  projectionStageLabel,
} from './miCaminoPilotView.js'

describe('Mi Camino pilot projection view', () => {
  it('muestra un avance acotado sin inferir métricas nuevas', () => {
    expect(projectionProgressPercent({ progress: { completed_action_count: 2, total_action_count: 3 } })).toBe(67)
    expect(projectionProgressPercent({ progress: { completed_action_count: 3, total_action_count: 0 } })).toBe(0)
    expect(projectionProgressPercent({ progress: { completed_action_count: 99, total_action_count: 3 } })).toBe(100)
  })

  it('distingue alta nueva, socio veterano y estados conocidos sin exponer P2 adicional', () => {
    expect(projectionStageLabel({ entry_mode: 'new', journey_day: 8 })).toBe('Día 8 · inicio')
    expect(projectionStageLabel({ entry_mode: 'veteran' })).toBe('Tu siguiente hito')
    expect(projectionActionStatusLabel('available')).toBe('Disponible')
    expect(projectionDataStatusLabel('fresh')).toBe('actualizado')
    expect(projectionDataStatusLabel('unknown')).toBe('pendiente de conectar')
  })
})
