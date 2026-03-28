/**
 * Clases de sesión EVO — colores alineados con WodBuster (manual de marca).
 * Único origen para Excel, coach badges, prompts y UI.
 *
 * EvoFuerza, EvoGimnástica y EvoTodos: solo cuando las instrucciones lo piden explícitamente.
 */

export const EVO_SESSION_CLASS_DEFS = [
  {
    key: 'evofuncional',
    feedbackKey: 'feedback_funcional',
    label: 'EvoFuncional',
    color: '#3C78D8',
    excelArgb: 'FF3C78D8',
  },
  {
    key: 'evobasics',
    feedbackKey: 'feedback_basics',
    label: 'EvoBasics',
    color: '#E69138',
    excelArgb: 'FFE69138',
  },
  {
    key: 'evofit',
    feedbackKey: 'feedback_fit',
    label: 'EvoFit',
    color: '#6AA84F',
    excelArgb: 'FF6AA84F',
  },
  {
    key: 'evohybrix',
    feedbackKey: 'feedback_hybrix',
    label: 'EvoHybrix',
    color: '#F4C430',
    excelArgb: 'FFF4C430',
  },
  {
    key: 'evofuerza',
    feedbackKey: 'feedback_fuerza',
    label: 'EvoFuerza',
    color: '#CC0000',
    excelArgb: 'FFCC0000',
  },
  {
    key: 'evogimnastica',
    feedbackKey: 'feedback_gimnastica',
    label: 'EvoGimnástica',
    color: '#E91E8C',
    excelArgb: 'FFE91E8C',
  },
  {
    key: 'evotodos',
    feedbackKey: 'feedback_evotodos',
    label: 'EvoTodos',
    color: '#A729AD',
    excelArgb: 'FFA729AD',
  },
]

/** Misma forma que usaba `generateExcel.js` (ExcelJS argb AARRGGBB). */
export const ALL_CLASSES = EVO_SESSION_CLASS_DEFS.map(({ key, feedbackKey, label, excelArgb }) => ({
  key,
  feedbackKey,
  label,
  bg: excelArgb,
}))

export const SESSION_BLOCKS = EVO_SESSION_CLASS_DEFS.map(({ key, label, color }) => ({
  key,
  label,
  color,
}))

/** Para prompts: lista { key, label } */
export const ALL_CLASS_KEYS = EVO_SESSION_CLASS_DEFS.map(({ key, label }) => ({ key, label }))

/** Mapa label → hex (p. ej. badges por nombre de clase en JSON) */
export const CLASS_COLOR_BY_LABEL = Object.fromEntries(
  EVO_SESSION_CLASS_DEFS.map(({ label, color }) => [label, color]),
)

/** Barra lateral guía coach: id de ficha → hex */
/** Etiquetas para toggles de clase en modales / preview */
export const ALL_CLASS_LABELS = EVO_SESSION_CLASS_DEFS.map(({ label }) => label)

export const CLASS_BAR_HEX = {
  funcional: '#3C78D8',
  basics: '#E69138',
  fit: '#6AA84F',
  hybrix: '#F4C430',
  fuerza: '#CC0000',
  gimnastica: '#E91E8C',
  evotodos: '#A729AD',
}
