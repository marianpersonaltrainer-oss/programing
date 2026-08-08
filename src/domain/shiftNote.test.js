import { describe, expect, it } from 'vitest'
import { buildShiftNoteInput } from './shiftNote.js'

const SHIFT_ID = '40000000-0000-4000-8000-000000000001'

describe('buildShiftNoteInput', () => {
  it('crea una novedad breve sin aceptar identidad ni campos post-clase', () => {
    expect(buildShiftNoteInput({
      shiftId: SHIFT_ID,
      noteType: 'team',
      teamNote: '  Falta reponer vendas.  ',
      personName: 'No debe viajar',
      userId: 'otro-usuario',
    })).toEqual({
      shift_id: SHIFT_ID,
      note_type: 'team',
      team_note: 'Falta reponer vendas.',
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
    })
  })

  it('normaliza los tres bloques del seguimiento post-clase', () => {
    expect(buildShiftNoteInput({
      shiftId: SHIFT_ID,
      noteType: 'post_class',
      personName: '  Alex Vega ',
      isFirstClass: true,
      mobilityTechnique: ' Mejor control de rodilla ',
      discomfortStatus: 'improved',
      discomfortZone: ' hombro derecho ',
      discomfortIntensity: '3',
      workVolumePercent: '75',
      loadsUsed: ' Mancuernas de 6 kg ',
      adaptedExercises: ' Press en suelo ',
    })).toEqual({
      shift_id: SHIFT_ID,
      note_type: 'post_class',
      team_note: null,
      person_name: 'Alex Vega',
      is_first_class: true,
      mobility_technique: 'Mejor control de rodilla',
      discomfort_status: 'improved',
      discomfort_zone: 'hombro derecho',
      discomfort_intensity: 3,
      work_volume_percent: 75,
      loads_used: 'Mancuernas de 6 kg',
      adapted_exercises: 'Press en suelo',
      schema_version: 1,
    })
  })

  it('representa “No tenía” con intensidad cero y sin zona', () => {
    const value = buildShiftNoteInput({
      shiftId: SHIFT_ID,
      noteType: 'post_class',
      personName: 'Nora Sol',
      mobilityTechnique: 'Técnica estable',
      discomfortStatus: 'none',
      discomfortZone: 'dato descartado',
      discomfortIntensity: 9,
      workVolumePercent: 100,
      loadsUsed: 'Peso corporal',
      adaptedExercises: 'Ninguno',
    })

    expect(value.discomfort_zone).toBeNull()
    expect(value.discomfort_intensity).toBe(0)
  })

  it.each(['stable', 'improved', 'worsened'])('exige zona e intensidad 0–10 para %s', (status) => {
    const base = {
      shiftId: SHIFT_ID,
      noteType: 'post_class',
      personName: 'Persona',
      mobilityTechnique: 'Observación',
      discomfortStatus: status,
      workVolumePercent: 50,
      loadsUsed: 'Sin cargas',
      adaptedExercises: 'Ninguno',
    }

    expect(() => buildShiftNoteInput({ ...base, discomfortZone: '', discomfortIntensity: 4 }))
      .toThrow('zona de la molestia')
    expect(() => buildShiftNoteInput({ ...base, discomfortZone: 'Lumbar', discomfortIntensity: 11 }))
      .toThrow('entre 0 y 10')
  })

  it.each([0, 24, 26, 101])('rechaza el volumen no permitido %s', (volume) => {
    expect(() => buildShiftNoteInput({
      shiftId: SHIFT_ID,
      noteType: 'post_class',
      personName: 'Persona',
      mobilityTechnique: 'Observación',
      discomfortStatus: 'none',
      workVolumePercent: volume,
      loadsUsed: 'Sin cargas',
      adaptedExercises: 'Ninguno',
    })).toThrow('25, 50, 75 o 100')
  })
})
