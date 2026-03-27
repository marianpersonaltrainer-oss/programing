export const CLASS_COLORS = {
  EvoFuncional:  { bg: '#2F7BBE', text: '#FFFFFF', label: 'EvoFuncional' },
  EvoBasics:     { bg: '#E07B39', text: '#FFFFFF', label: 'EvoBasics' },
  EvoFit:        { bg: '#2FBE7B', text: '#FFFFFF', label: 'EvoFit' },
  Fuerza:        { bg: '#BE2F2F', text: '#FFFFFF', label: 'Bloque Fuerza' },
  Gimnasticos:   { bg: '#D93F8E', text: '#FFFFFF', label: 'Gimnásticos' },
  HYBRIX:        { bg: '#E0C12F', text: '#111111', label: 'HYBRIX' },
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
