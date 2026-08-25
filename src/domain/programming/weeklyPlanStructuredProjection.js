function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function textOrNull(value) {
  const text = String(value || '').trim()
  return text || null
}

/**
 * Conservatively projects an imported Excel week into the structured PE2 model.
 *
 * The original programming text remains intact in a single block. We do not try
 * to infer exercises, prescriptions or video links from free text: that needs a
 * separate reviewed enrichment flow.
 */
export function projectWeeklyPlanForStructuredReview({ weeklyPlan, classTypes, weekId, orgId }) {
  if (!weekId || !orgId) {
    throw new Error('Falta la semana u organización para preparar la revisión estructurada.')
  }

  const typesBySlug = new Map(
    (classTypes || [])
      .filter((classType) => classType?.id)
      .map((classType) => [normalizeKey(classType.slug), classType])
  )

  const projected = []
  const usedSlots = new Set()

  for (const [index, source] of (weeklyPlan?.sessions || []).entries()) {
    const programming = textOrNull(source?.programming)
    if (!programming) continue

    const weekday = Number(source?.weekday)
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 6) {
      throw new Error(`La sesión ${index + 1} no tiene un día válido.`)
    }

    const classType = typesBySlug.get(normalizeKey(source?.classTypeKey))
    if (!classType) {
      throw new Error(`No se ha encontrado el tipo de clase «${source?.classType || source?.classTypeKey || 'sin nombre'}» en esta organización.`)
    }

    const slotKey = `${classType.id}:${weekday}`
    if (usedSlots.has(slotKey)) {
      throw new Error(`Hay dos sesiones importadas para el mismo grupo y día (${source?.classType || source?.classTypeKey}, día ${weekday}).`)
    }
    usedSlots.add(slotKey)

    projected.push({
      week_id: weekId,
      org_id: orgId,
      class_type_id: classType.id,
      weekday,
      title: textOrNull(source?.title) || `${source?.classType || 'Sesión'} · día ${weekday}`,
      objective: null,
      dominant_pattern: null,
      briefing: textOrNull(source?.feedback),
      est_minutes: null,
      status: 'ai_draft',
      blocks: [
        {
          kind: 'A',
          name: 'Programación importada',
          dose: null,
          duration_min: null,
          sort_order: 0,
          items: [
            {
              raw_text: programming,
              prescription: null,
              sort_order: 0,
            },
          ],
        },
      ],
    })
  }

  if (!projected.length) {
    throw new Error('La semana no contiene sesiones con programación para estructurar.')
  }

  return projected
}
