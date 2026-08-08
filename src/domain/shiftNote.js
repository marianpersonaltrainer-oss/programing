export const SHIFT_NOTE_TYPES = Object.freeze(['team', 'post_class'])
export const DISCOMFORT_STATUSES = Object.freeze(['none', 'stable', 'improved', 'worsened'])
export const WORK_VOLUME_OPTIONS = Object.freeze([25, 50, 75, 100])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TEXT_LIMITS = Object.freeze({
  personName: 120,
  teamNote: 600,
  detail: 400,
})

function requiredChoice(value, allowed, message) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!allowed.includes(normalized)) throw new Error(message)
  return normalized
}

function cleanText(value, { field, required = false, limit = TEXT_LIMITS.detail } = {}) {
  const clean = String(value || '').trim()
  if (required && !clean) throw new Error(`Completa ${field}.`)
  if (clean.length > limit) throw new Error(`${field} no puede superar ${limit} caracteres.`)
  return clean || null
}

export function buildShiftNoteInput(input = {}) {
  const shiftId = String(input.shiftId || '').trim()
  if (!UUID_PATTERN.test(shiftId)) throw new Error('No se ha podido identificar este turno.')
  const noteType = requiredChoice(
    input.noteType,
    SHIFT_NOTE_TYPES,
    'Elige una novedad del turno o un seguimiento post-clase.',
  )

  if (noteType === 'team') {
    return {
      shift_id: shiftId,
      note_type: 'team',
      team_note: cleanText(input.teamNote, {
        field: 'qué debe saber el equipo',
        required: true,
        limit: TEXT_LIMITS.teamNote,
      }),
      person_name: null,
      is_first_class: false,
      mobility_technique: null,
      discomfort_status: null,
      discomfort_zone: null,
      discomfort_intensity: null,
      work_volume_percent: null,
      loads_used: null,
      adapted_exercises: null,
      schema_version: 1,
    }
  }

  const discomfortStatus = requiredChoice(
    input.discomfortStatus,
    DISCOMFORT_STATUSES,
    'Indica si no tenía molestia, estaba estable, mejoró o empeoró.',
  )
  const volume = Number(input.workVolumePercent)
  if (!WORK_VOLUME_OPTIONS.includes(volume)) {
    throw new Error('Selecciona el volumen completado: 25, 50, 75 o 100 %.')
  }

  let discomfortZone = null
  let discomfortIntensity = 0
  if (discomfortStatus !== 'none') {
    discomfortZone = cleanText(input.discomfortZone, {
      field: 'la zona de la molestia o lesión',
      required: true,
    })
    if (input.discomfortIntensity === '' || input.discomfortIntensity == null) {
      throw new Error('Indica la intensidad de la molestia entre 0 y 10.')
    }
    discomfortIntensity = Number(input.discomfortIntensity)
    if (!Number.isInteger(discomfortIntensity) || discomfortIntensity < 0 || discomfortIntensity > 10) {
      throw new Error('La intensidad debe ser un número entero entre 0 y 10.')
    }
  }

  return {
    shift_id: shiftId,
    note_type: 'post_class',
    team_note: null,
    person_name: cleanText(input.personName, {
      field: 'el nombre de la persona',
      required: true,
      limit: TEXT_LIMITS.personName,
    }),
    is_first_class: input.isFirstClass === true,
    mobility_technique: cleanText(input.mobilityTechnique, {
      field: 'la observación de movilidad o técnica',
      required: true,
    }),
    discomfort_status: discomfortStatus,
    discomfort_zone: discomfortZone,
    discomfort_intensity: discomfortIntensity,
    work_volume_percent: volume,
    loads_used: cleanText(input.loadsUsed, {
      field: 'las cargas utilizadas',
      required: true,
    }),
    adapted_exercises: cleanText(input.adaptedExercises, {
      field: 'los ejercicios adaptados',
      required: true,
    }),
    schema_version: 1,
  }
}
