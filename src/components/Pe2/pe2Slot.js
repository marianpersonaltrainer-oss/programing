import { MESOCYCLES } from '../../constants/evoColors.js'

export function formatPe2SlotLabel({ mesociclo, semana }) {
  const meso = MESOCYCLES.find((m) => m.value === mesociclo)
  const label = meso?.label || mesociclo
  return `${label} · S${semana}`
}

export const PE2_WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const PE2_WEEKDAY_NUMBERS = [1, 2, 3, 4, 5, 6]

export const PE2_STATUS_LABELS = {
  draft: 'Borrador',
  generating: 'Generando',
  ready: 'Lista',
  archived: 'Archivada',
}

export const PE2_SESSION_STATUS_LABELS = {
  empty: 'Vacía',
  ai_draft: 'Borrador IA',
  confirmed: 'Confirmada',
}

export const PE2_PATTERN_LABELS = {
  squat: 'Squat',
  hinge: 'Bisagra',
  push: 'Empuje',
  pull: 'Jalón',
  core: 'Core',
  full: 'Full body',
}

export { MESOCYCLES as PE2_MESOCYCLES }
