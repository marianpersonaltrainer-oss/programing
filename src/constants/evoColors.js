/** Colores WodBuster — ver `evoClasses.js` */
export const CLASS_COLORS = {
  EvoFuncional: { bg: '#3C78D8', text: '#FFFFFF', label: 'EvoFuncional' },
  EvoBasics: { bg: '#E69138', text: '#FFFFFF', label: 'EvoBasics' },
  EvoFit: { bg: '#6AA84F', text: '#FFFFFF', label: 'EvoFit' },
  EvoHybrix: { bg: '#F4C430', text: '#111111', label: 'EvoHybrix' },
  EvoFuerza: { bg: '#CC0000', text: '#FFFFFF', label: 'EvoFuerza' },
  'EvoGimnástica': { bg: '#E91E8C', text: '#FFFFFF', label: 'EvoGimnástica' },
  EvoTodos: { bg: '#A729AD', text: '#FFFFFF', label: 'EvoTodos' },
  Fuerza: { bg: '#CC0000', text: '#FFFFFF', label: 'Bloque Fuerza' },
  Gimnasticos: { bg: '#E91E8C', text: '#FFFFFF', label: 'Gimnásticos' },
  HYBRIX: { bg: '#F4C430', text: '#111111', label: 'HYBRIX' },
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
