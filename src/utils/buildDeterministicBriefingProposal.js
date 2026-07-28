import { EXCEL_DAY_ORDER } from './excelGenerationPlan.js'
import { normalizeWeeklyArchitecturePlan } from './weeklyArchitecturePlan.js'

function classesForDay(weeklyOffer, day) {
  const list = weeklyOffer?.dias?.[day]
  if (!Array.isArray(list)) return []
  return list.map((key) => String(key || '').trim()).filter(Boolean)
}

/**
 * Propuesta mínima determinista cuando falla la IA o Marian usa modo manual.
 * Cumple el schema de weeklyArchitecture para poder generar sesiones.
 */
export function buildDeterministicBriefingProposal({
  mesociclo = '',
  semana = 1,
  generationDays = [],
  weeklyOffer = null,
  userInstructions = '',
  suggestedFocus = '',
  title: titleOverride = '',
}) {
  const days =
    Array.isArray(generationDays) && generationDays.length
      ? [...generationDays]
      : [...EXCEL_DAY_ORDER]

  const title =
    String(titleOverride || '').trim() ||
    `PROPUESTA MANUAL — S${semana}${mesociclo ? ` · ${String(mesociclo).toUpperCase()}` : ''}`

  const narrative =
    String(userInstructions || '').trim().slice(0, 900) ||
    `Semana ${semana}${mesociclo ? ` del mesociclo ${mesociclo}` : ''}: programación con la oferta seleccionada, progresión coherente y contraste estructural entre días consecutivos.`

  const focus =
    String(suggestedFocus || '').trim().slice(0, 160) ||
    'Consolidación técnica, carga controlada y variedad de formatos entre días.'

  const weeklyArchitectureRaw = days.map((day, index) => {
    const classKeys = classesForDay(weeklyOffer, day)
    const prevDay = index > 0 ? days[index - 1] : null
    return {
      day,
      intent: `Intención ${day.toLowerCase()}: estímulo alineado con mesociclo y clases marcadas.`,
      classPlans: (classKeys.length ? classKeys : ['evofuncional']).map((classKey) => ({
        classKey,
        plan:
          'Bloque técnico de fuerza/skill + metabólico con trabajo/descanso explícito; material acorde a la biblioteca EVO.',
      })),
      sharedFatigue: 'Proteger hombro y zona lumbar compartida entre modalidades del mismo día.',
      antiRepetition: prevDay
        ? `No repetir el esqueleto dominante de ${prevDay}; cambiar familia de movimiento y formato.`
        : 'Abrir semana con patrón distinto al cierre de la progresión reciente.',
    }
  })

  const weeklyArchitecture = normalizeWeeklyArchitecturePlan(weeklyArchitectureRaw, {
    generationDays: days,
    weeklyOffer,
  })

  return { title, narrative, suggestedFocus: focus, weeklyArchitecture }
}
