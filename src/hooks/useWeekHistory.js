const HISTORY_KEY = 'programingevo_history'

function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
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

  // Reemplazar si ya existe esa semana, si no, añadir
  const idx = history[mesociclo].findIndex((e) => e.semana === semana)
  if (idx >= 0) {
    history[mesociclo][idx] = entry
  } else {
    history[mesociclo].push(entry)
  }

  // Ordenar por semana
  history[mesociclo].sort((a, b) => a.semana - b.semana)
  saveHistory(history)
}

// Devuelve el historial de un mesociclo concreto
export function getHistoryForMesocycle(mesociclo) {
  if (!mesociclo) return []
  const history = loadHistory()
  return history[mesociclo] || []
}

// Elimina una semana concreta del historial
export function deleteWeekFromHistory(mesociclo, semana) {
  const history = loadHistory()
  if (!history[mesociclo]) return
  history[mesociclo] = history[mesociclo].filter((e) => e.semana !== semana)
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
