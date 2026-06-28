import { MESOCYCLES } from '../../constants/evoColors.js'

const STORAGE_KEY = 'programingevo_week'

export function readPe2SlotFromV1() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { mesociclo: 'fuerza', semana: 1, phase: null }
    const parsed = JSON.parse(saved)
    const mesociclo = parsed?.mesocycle || MESOCYCLES[0]?.value || 'fuerza'
    const semana = Number(parsed?.week) > 0 ? Number(parsed.week) : 1
    return { mesociclo, semana, phase: parsed?.phase || null }
  } catch {
    return { mesociclo: 'fuerza', semana: 1, phase: null }
  }
}

export function formatPe2SlotLabel({ mesociclo, semana }) {
  const meso = MESOCYCLES.find((m) => m.value === mesociclo)
  const label = meso?.label || mesociclo
  return `${label} · S${semana}`
}

export const PE2_STATUS_LABELS = {
  draft: 'Borrador',
  generating: 'Generando',
  ready: 'Lista',
  archived: 'Archivada',
}
