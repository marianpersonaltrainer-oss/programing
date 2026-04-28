const HISTORY_KEY = 'programingevo_history'

export function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

/** Lista de mesociclos que tienen al menos una semana guardada en este dispositivo. */
export function listMesocyclesInHistory() {
  return Object.keys(loadHistory()).sort()
}

/** Resumen para UI: mesociclo + nº de semanas en localStorage (cada mesociclo es una clave aparte). */
export function getAllMesocycleSummaries() {
  const history = loadHistory()
  return Object.keys(history)
    .map((mesociclo) => {
      const weeks = history[mesociclo] || []
      const uniq = new Set(weeks.map((e) => Number(e?.semana || 0)).filter((n) => Number.isFinite(n) && n > 0))
      return { mesociclo, count: uniq.size }
    })
    .sort((a, b) => a.mesociclo.localeCompare(b.mesociclo))
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // ignore quota errors
  }
}

// Guarda una semana en el historial bajo la clave del mesociclo
export function saveWeekToHistory(mesociclo, semana, weekData) {
  if (!mesociclo || !weekData) return
  const history = loadHistory()
  if (!history[mesociclo]) history[mesociclo] = []

  // Guardar resumen compacto: titulo + resumen + nombre de días con sus WODs (no texto completo)
  const entry = {
    entryId:
      Date.now().toString(36) +
      '-' +
      Math.random()
        .toString(36)
        .slice(2, 8),
    semana,
    titulo: weekData.titulo,
    resumen: weekData.resumen || null,
    dias: (weekData.dias || []).map((dia) => ({
      nombre: dia.nombre,
      // Extraer solo el bloque WOD del texto de cada clase para el contexto
      wodFuncional: extractWod(dia.evofuncional),
      wodBasics:    extractWod(dia.evobasics),
      wodFit:       extractWod(dia.evofit),
    })),
    /** Copia completa del JSON para reabrir en el modal (editar / publicar). */
    weekDataFull: JSON.parse(JSON.stringify(weekData)),
    savedAt: new Date().toISOString(),
  }

  // Versionado local: conservar varias copias por semana para poder recuperar borradores antiguos.
  history[mesociclo].push(entry)
  // Limitar crecimiento: máx 8 versiones por semana, y 80 entradas totales por mesociclo.
  const byWeek = {}
  for (const e of history[mesociclo]) {
    const w = Number(e?.semana || 0)
    if (!byWeek[w]) byWeek[w] = []
    byWeek[w].push(e)
  }
  const trimmed = []
  for (const weekKey of Object.keys(byWeek)) {
    const group = byWeek[weekKey]
      .slice()
      .sort((a, b) => new Date(b?.savedAt || 0).getTime() - new Date(a?.savedAt || 0).getTime())
      .slice(0, 8)
    trimmed.push(...group)
  }
  history[mesociclo] = trimmed
    .sort((a, b) => new Date(b?.savedAt || 0).getTime() - new Date(a?.savedAt || 0).getTime())
    .slice(0, 80)
  saveHistory(history)
}

// Devuelve el historial de un mesociclo concreto
export function getHistoryForMesocycle(mesociclo) {
  if (!mesociclo) return []
  const history = loadHistory()
  return (history[mesociclo] || [])
    .slice()
    .sort((a, b) => new Date(b?.savedAt || 0).getTime() - new Date(a?.savedAt || 0).getTime())
}

// Elimina una versión concreta del historial (fallback a semana completa si no hay entryId).
export function deleteWeekFromHistory(mesociclo, semana, entryId = null) {
  const history = loadHistory()
  if (!history[mesociclo]) return
  if (entryId) {
    history[mesociclo] = history[mesociclo].filter((e) => e.entryId !== entryId)
  } else {
    history[mesociclo] = history[mesociclo].filter((e) => e.semana !== semana)
  }
  if (!history[mesociclo].length) delete history[mesociclo]
  saveHistory(history)
}

// Elimina el historial completo de un mesociclo
export function clearHistoryForMesocycle(mesociclo) {
  const history = loadHistory()
  delete history[mesociclo]
  saveHistory(history)
}

// Formatea el historial como texto para enviar a la IA como contexto
export function formatHistoryAsContext(entries) {
  if (!entries.length) return ''
  return entries.map((entry) => {
    const lines = [`=== SEMANA ${entry.semana} — ${entry.titulo || ''} ===`]
    if (entry.resumen) {
      lines.push(`Estímulo: ${entry.resumen.estimulo || ''}`)
      lines.push(`Intensidad: ${entry.resumen.intensidad || ''}`)
      lines.push(`Foco: ${entry.resumen.foco || ''}`)
    }
    for (const dia of (entry.dias || [])) {
      lines.push(`\n${dia.nombre}:`)
      if (dia.wodFuncional) lines.push(`  EvoFuncional WOD: ${dia.wodFuncional}`)
      if (dia.wodBasics)    lines.push(`  EvoBasics WOD: ${dia.wodBasics}`)
      if (dia.wodFit)       lines.push(`  EvoFit WOD: ${dia.wodFit}`)
    }
    return lines.join('\n')
  }).join('\n\n')
}

// Extrae el bloque WOD del texto de una sesión
function extractWod(sessionText) {
  if (!sessionText) return ''
  // Busca desde "WOD" hasta el siguiente bloque con "("
  const match = sessionText.match(/WOD[^\n]*\n([\s\S]*?)(?=\(\d+['′]|\nFEEDBACK|$)/i)
  if (match) return match[1].trim().slice(0, 300)
  return ''
}
