/** Colores por clase (UI / export) — alineado con `evoClasses.js` */
export const CLASS_COLORS = {
  EvoFuncional: { bg: '#6A1F6D', text: '#FFFFFF', label: 'EvoFuncional' },
  EvoBasics: { bg: '#E69138', text: '#FFFFFF', label: 'EvoBasics' },
  EvoFit: { bg: '#6AA84F', text: '#FFFFFF', label: 'EvoFit' },
  EvoHybrix: { bg: '#2563EB', text: '#FFFFFF', label: 'EvoHybrix' },
  EvoFuerza: { bg: '#CC0000', text: '#FFFFFF', label: 'EvoFuerza' },
  'EvoGimnástica': { bg: '#C9A227', text: '#1A1408', label: 'EvoGimnástica' },
  EvoTodos: { bg: '#A729AD', text: '#FFFFFF', label: 'EvoTodos' },
  Fuerza: { bg: '#CC0000', text: '#FFFFFF', label: 'Bloque Fuerza' },
  Gimnasticos: { bg: '#C9A227', text: '#1A1408', label: 'Gimnásticos' },
  HYBRIX: { bg: '#2563EB', text: '#FFFFFF', label: 'HYBRIX' },
}

export const DAYS_ES = {
  monday:    'Lunes',
  tuesday:   'Martes',
  wednesday: 'Miércoles',
  thursday:  'Jueves',
  friday:    'Viernes',
  saturday:  'Sábado',
}

export const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const MESOCYCLES = [
  { value: 'fuerza',    label: 'Fuerza',    weeks: 6 },
  { value: 'autocarga', label: 'Autocarga', weeks: 5 },
  { value: 'mixto',     label: 'Mixto',     weeks: 4 },
]

export const AUTOCARGA_PHASES = [
  'Base',
  'Densidad',
  'Volumen Mixto',
  'Peak',
  'Test',
]
