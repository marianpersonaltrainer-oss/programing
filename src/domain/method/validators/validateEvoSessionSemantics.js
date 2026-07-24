import { splitEvoSessionBlocks } from '../evoBasicsSkills.js'
import { METHOD_EVO_V1 } from '../methodEvoV1.js'
import { readDurationMinutes, readTimeCapMinutes } from './evoDurationUtils.js'

function issue(code, message, severity = 'error') {
  return { code, message, severity }
}

function parseRestSeconds(text) {
  const match = String(text || '').match(/\b(?:descanso|rest)\s+(\d+(?:[.,]\d+)?)\s*(seg(?:undos?)?|sec|min(?:utos?)?)\b/i)
  if (!match) return null
  let value = Number(match[1].replace(',', '.'))
  if (/min/i.test(match[2])) value *= 60
  return value
}

function validateRoundRestVsCap(title, body) {
  const capMin = readTimeCapMinutes(title) ?? readDurationMinutes(title)
  if (capMin == null) return null

  const roundsMatch = String(body || '').match(/\b(\d+)\s*(?:rondas?|rounds?)\b/i)
  if (!roundsMatch) return null

  const restSec = parseRestSeconds(body)
  if (restSec == null) return null

  const rounds = Number(roundsMatch[1])
  const afterEachRound =
    /\b(?:despu[eé]s|after)\s+de\s+cada\s+ronda\b/i.test(body) ||
    /\bdespu[eé]s\s+de\s+cada\s+ronda\s+completa\b/i.test(body)
  const totalRestSec = restSec * (afterEachRound ? rounds : Math.max(0, rounds - 1))
  const minWorkSec = rounds * 25

  if (totalRestSec + minWorkSec > capMin * 60 + 0.5) {
    return issue(
      'VAL-TIME-004',
      `La estructura (${rounds} rondas con descansos fijos) no cabe en ${capMin} min de time cap: solo el descanso mínimo suma ~${Math.round(totalRestSec / 60)} min sin contar el trabajo.`,
    )
  }
  return null
}

function validateStationBurstVsBlock(title, body) {
  const text = `${title}\n${body}`
  const blockMinMatch =
    text.match(/\bbloques?\s+de\s+(\d+(?:[.,]\d+)?)\s*min\b/i) ||
    text.match(/\bestaci[oó]n(?:es)?[^.\n]{0,40}?(\d+(?:[.,]\d+)?)\s*min\b/i)
  const burstMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:seg(?:undos?)?|sec|["″′])\s*[^.\n]{0,100}?(?:seguido|seguidos?)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:seg(?:undos?)?|sec|min(?:utos?)?)/i,
  )
  const countMatch = text.match(/\b(\d+)\s*(?:r[aá]fagas?|series|vueltas)\s+totales\b/i)
  if (!blockMinMatch || !burstMatch) return null

  const blockMin = Number(blockMinMatch[1].replace(',', '.'))
  let workSec = Number(burstMatch[1].replace(',', '.'))
  let restSec = Number(burstMatch[2].replace(',', '.'))
  if (/min/i.test(burstMatch[0].slice(burstMatch[0].indexOf(burstMatch[2])))) restSec *= 60
  const bursts = countMatch ? Number(countMatch[1]) : 1
  const totalSec = bursts * (workSec + restSec)

  if (totalSec > blockMin * 60 + 0.5) {
    return issue(
      'VAL-TIME-004',
      `La estación pide ${bursts}×(${Math.round(workSec)} s + ${Math.round(restSec)} s) = ${Math.round(totalSec / 60)} min dentro de un bloque de ${blockMin} min.`,
    )
  }
  return null
}

function validateBarbellLogistics(text) {
  const perPersonMatch = String(text || '').match(
    /\b(?:(\d+)|uno|una|dos|tres|cuatro|cinco)\s*barras?\s+por\s+(?:persona|atleta|alumno)\b/i,
  )
  if (!perPersonMatch) return null

  const wordMap = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 }
  const raw = perPersonMatch[1] || perPersonMatch[0].match(/\b(uno|una|dos|tres|cuatro|cinco)\b/i)?.[1]
  const perAthlete = Number(raw) || wordMap[String(raw || '').toLowerCase()] || 0
  if (!perAthlete) return null
  const capacity = METHOD_EVO_V1.current_context.reference_class_capacity || 10
  const bars = METHOD_EVO_V1.current_context.inventory.bars
  const available =
    Object.values(bars.by_weight_kg || {}).reduce((sum, n) => sum + Number(n || 0), 0) +
    Number(bars.technical_180cm || 0)
  const needed = perAthlete * capacity

  if (needed > available) {
    return issue(
      'VAL-LOGISTICS-001',
      `«${perAthlete} barras por persona» implica ~${needed} barras con ${capacity} personas; el inventario confirma ${available} barras disponibles.`,
    )
  }
  return null
}

function validateLoads(text, classKey) {
  const errors = []
  const value = String(text || '')

  if (
    /\bdumbbell\s+snatch\b/i.test(value) &&
    /\b(?:22[,.]5|2[3-9]|30)\s*kg\b/i.test(value) &&
    /\b(?:rondas?|amrap|por\s+tiempo|wod|alternando)\b/i.test(value)
  ) {
    errors.push(
      issue(
        'VAL-LOAD-001',
        'Dumbbell Snatch por encima de 22 kg en volumen de WOD no encaja con el perfil EVO medio; baja carga o usa progresión individual explícita.',
      ),
    )
  }

  if (
    /\b(?:power\s+snatch|hang\s+(?:power\s+)?snatch|muscle\s+snatch)\b/i.test(value) &&
    /\b(?:40|50|60)\s*[-–]\s*(?:50|60|70)\s*kg\b/i.test(value) &&
    !/@\s*\d+\s*%|\b(?:82|87|9[0-5])\s*%\b/i.test(value)
  ) {
    errors.push(
      issue(
        'VAL-LOAD-001',
        'La halterofilia técnica usa un rango genérico (40–60 kg) sin % individual; define carga relativa o rangos por nivel.',
      ),
    )
  }

  if (classKey === 'evofit' && /\b(?:40|50|60)\s*kg\b/i.test(value) && /\bsnatch\b/i.test(value)) {
    errors.push(
      issue(
        'VAL-LOAD-001',
        'EvoFit no debe fijar cargas absolutas altas de snatch como referencia general de clase.',
      ),
    )
  }

  return errors
}

function validateModalityIdentity(text, classKey) {
  const session = String(text || '')
  if (!session.trim()) return []

  if (classKey === 'evogimnastica') {
    const blocks = splitEvoSessionBlocks(session)
    const mainHeader = blocks[0]?.header || session.split('\n')[0] || ''
    const gymnasticsMain =
      /\b(?:handstand|pino|ring|muscle[- ]?up|toes\s+to\s+(?:bar|rings)|gimn[aá]stic|strict\s+pull[\s-]?up|hspu)\b/i.test(
        mainHeader,
      )
    const weightliftingPrimary =
      /\b(?:power\s+snatch|hang\s+snatch|clean\s+and\s+jerk|capacidad\s+principal[^.\n]{0,40}?snatch)\b/i.test(
        mainHeader,
      )
    if (weightliftingPrimary && !gymnasticsMain) {
      return [
        issue(
          'VAL-IDENTITY-001',
          'EvoGimnástica no puede abrir como halterofilia olímpica (p. ej. Power Snatch); la capacidad gimnástica debe protagonizar el bloque principal.',
        ),
      ]
    }
  }

  if (classKey === 'evobasics') {
    const blocks = splitEvoSessionBlocks(session)
    const hasStrengthPress = blocks.some(
      (block) => /\bFUERZA\b/i.test(block.header) && /\b(?:strict\s+press|press\s+(?:con\s+)?barra)\b/i.test(`${block.header}\n${block.text}`),
    )
    const hasSkillPress = blocks.some(
      (block) => /\bSKILL\b/i.test(block.header) && /\b(?:shoulder\s+press|press\s+(?:con\s+)?(?:dumbbell|db|mancuerna))\b/i.test(`${block.header}\n${block.text}`),
    )
    const hasWodPress = blocks.some(
      (block) => /\b(?:WOD|APLICACI[OÓ]N)\b/i.test(block.header) && /\b(?:shoulder\s+press|strict\s+press|press\b)/i.test(`${block.header}\n${block.text}`),
    )
    if (hasStrengthPress && hasSkillPress && hasWodPress) {
      return [
        issue(
          'VAL-IDENTITY-001',
          'EvoBasics repite el mismo patrón de press vertical en fuerza, skill y WOD; rota el skill principal o simplifica la aplicación.',
        ),
      ]
    }
  }

  if (classKey === 'evohybrix') {
    const blockMin = readDurationMinutes(session.split('\n')[0] || '')
    const burstIssue = validateStationBurstVsBlock(session.split('\n')[0] || '', session)
    if (burstIssue) return [burstIssue]
    if (/\bestaci[oó]n(?:es)?\b/i.test(session) && blockMin != null && blockMin < 40 && /\bPARTE\s+[UÚ]NICA\b/i.test(session)) {
      const stationCount = (session.match(/\bestaci[oó]n\s+\d+/gi) || []).length
      if (stationCount >= 4 && blockMin < 35) {
        return [
          issue(
            'VAL-HYBRIX-001',
            `EvoHybrix con ${stationCount} estaciones necesita tiempo efectivo suficiente (≈40 min), no ${blockMin} min de título.`,
          ),
        ]
      }
    }
  }

  return []
}

/** Validaciones semánticas de contenido real por sesión (tiempos, identidad, cargas, logística). */
export function validateEvoSessionSemantics(raw, options = {}) {
  const text = String(raw || '').trim()
  if (!text || /^\(no programada esta semana\)$/i.test(text) || /^FESTIVO\b/i.test(text)) {
    return { errors: [], warnings: [] }
  }

  const errors = []
  const classKey = String(options.classKey || '').toLowerCase()
  const blocks = splitEvoSessionBlocks(text)

  if (blocks.length === 0) {
    const lines = text.split('\n')
    const timingIssue = validateRoundRestVsCap(lines[0] || '', lines.slice(1).join('\n'))
    if (timingIssue) errors.push(timingIssue)
  } else {
    for (const block of blocks) {
      const timingIssue = validateRoundRestVsCap(block.header, block.text)
      if (timingIssue) errors.push(timingIssue)
    }
  }

  const burstIssue = validateStationBurstVsBlock(text.split('\n')[0] || '', text)
  if (burstIssue) errors.push(burstIssue)

  const logisticsIssue = validateBarbellLogistics(text)
  if (logisticsIssue) errors.push(logisticsIssue)

  errors.push(...validateLoads(text, classKey))
  errors.push(...validateModalityIdentity(text, classKey))

  return { errors, warnings: [] }
}
