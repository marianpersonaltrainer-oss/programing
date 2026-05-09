import { ALL_CLASS_LABELS } from '../constants/evoClasses.js'

/**
 * Colores de acento por clase en pantalla de feedback (legible sobre fondo oscuro).
 * EvoFuncional = azul, EvoBasics = naranja, EvoFit = verde (petición equipo).
 */
const CHROME_BY_LABEL = {
  EvoFuncional: {
    bar: '#2563EB',
    softBg: 'rgba(37, 99, 235, 0.12)',
    border: 'rgba(37, 99, 235, 0.45)',
    text: '#1E3A8A',
  },
  EvoBasics: {
    bar: '#EA580C',
    softBg: 'rgba(234, 88, 12, 0.12)',
    border: 'rgba(234, 88, 12, 0.45)',
    text: '#7C2D12',
  },
  EvoFit: {
    bar: '#16A34A',
    softBg: 'rgba(22, 163, 74, 0.12)',
    border: 'rgba(22, 163, 74, 0.45)',
    text: '#14532D',
  },
  EvoHybrix: {
    bar: '#CA8A04',
    softBg: 'rgba(202, 138, 4, 0.14)',
    border: 'rgba(202, 138, 4, 0.5)',
    text: '#713F12',
  },
  EvoFuerza: {
    bar: '#DC2626',
    softBg: 'rgba(220, 38, 38, 0.12)',
    border: 'rgba(220, 38, 38, 0.45)',
    text: '#7F1D1D',
  },
  'EvoGimnástica': {
    bar: '#DB2777',
    softBg: 'rgba(219, 39, 119, 0.12)',
    border: 'rgba(219, 39, 119, 0.45)',
    text: '#831843',
  },
  EvoTodos: {
    bar: '#9333EA',
    softBg: 'rgba(147, 51, 234, 0.12)',
    border: 'rgba(147, 51, 234, 0.45)',
    text: '#581C87',
  },
}

const DEFAULT_CHROME = {
  bar: '#64748B',
  softBg: 'rgba(100, 116, 139, 0.12)',
  border: 'rgba(100, 116, 139, 0.4)',
  text: '#334155',
}

export function feedbackClassChrome(classLabel) {
  const k = String(classLabel || '').trim()
  return CHROME_BY_LABEL[k] || DEFAULT_CHROME
}

/** Orden fijo de bloques en UI (misma lista que selects de clase). */
export function sortClassLabelsForFeedback(labels) {
  const order = [...ALL_CLASS_LABELS]
  return [...labels].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    const sa = ia === -1 ? 999 : ia
    const sb = ib === -1 ? 999 : ib
    if (sa !== sb) return sa - sb
    return String(a).localeCompare(String(b))
  })
}
