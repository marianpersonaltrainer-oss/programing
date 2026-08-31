export const STIMULUS_OPTIONS = [
  { value: 'achieved', label: 'Se logró' },
  { value: 'short', label: 'Se quedó corto' },
  { value: 'hard', label: 'Demasiado duro' },
  { value: 'blocked', label: 'Frenó técnica o logística' },
]

export const TIME_CAUSE_OPTIONS = [
  { value: 'explanation', label: 'Explicación' },
  { value: 'technique', label: 'Técnica' },
  { value: 'setup', label: 'Montaje' },
  { value: 'loads', label: 'Cargas' },
  { value: 'wod', label: 'WOD' },
]

export const NEXT_FOCUS_OPTIONS = [
  { value: 'load_scale', label: 'Carga / escala' },
  { value: 'clock_volume', label: 'Reloj / volumen' },
  { value: 'technique', label: 'Técnica' },
  { value: 'setup_material', label: 'Montaje / material' },
  { value: 'fatigue', label: 'Fatiga' },
]

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || ''
}

/** Conserva el esquema actual y añade etiquetas útiles para programación. */
export function buildStructuredCoachFeedback({
  stimulus,
  timeExplain,
  timeCause,
  classNote,
  nextFocus,
  nextNote,
}) {
  const groupLines = []
  const stimulusLabel = optionLabel(STIMULUS_OPTIONS, stimulus)
  if (stimulusLabel) groupLines.push(`Estímulo: ${stimulusLabel}`)

  if (timeExplain && timeExplain !== 'si') {
    const causeLabel = optionLabel(TIME_CAUSE_OPTIONS, timeCause)
    if (causeLabel) groupLines.push(`Tiempo: ${causeLabel}`)
  }

  const note = String(classNote || '').trim()
  if (note) groupLines.push(note)

  const nextLines = []
  const focusLabel = optionLabel(NEXT_FOCUS_OPTIONS, nextFocus)
  if (focusLabel) nextLines.push(`Foco: ${focusLabel}`)
  const handoff = String(nextNote || '').trim()
  if (handoff) nextLines.push(handoff)

  return {
    groupFeelings: groupLines.join('\n') || null,
    notesNextWeek: nextLines.join('\n') || null,
  }
}
