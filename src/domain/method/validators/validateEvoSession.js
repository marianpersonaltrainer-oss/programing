import { findComplexEvoBasicsFamiliesInConditioning } from '../evoBasicsSkills.js'
import { EVO_INVENTORY, validateHighSetupReuse } from '../evoInventory.js'
import {
  intervalClockMinutesFromBlock,
  isEvoStrengthBlock,
  isEvoMetabolicIntervalBlock,
  validateEvoMetabolicWorkRest,
  validateEvoSessionEquipmentCapacity,
  validateEvoStrengthRest,
  validateEvoVisibleSessionDuration,
} from './evoQualitySignals.js'

const FORBIDDEN_VISIBLE_LINE_RE =
  /^(BIENVENIDA|MOVILIDAD|CALENTAMIENTO|ACTIVACI[OÓ]N(?:\s+GENERAL)?|PREPARACI[OÓ]N|WOD\s*PREP|TRANSICI[OÓ]N|CIERRE|TIEMPO\s+EFECTIVO)\b/i
const FULL_HOUR_TIMELINE_RE = /(?:^|\s)0\s*['′]?\s*[-–—]\s*60\s*['′]?(?:\s|$)/i
const BLOCK_HEADER_RE = /^([ABC])\)\s*(.+)$/i
const PART_UNIQUE_HEADER_RE = /^PARTE\s+[UÚ]NICA\b(.*)$/i

function issue(code, message, severity = 'error') {
  return { code, message, severity }
}

function readDurationMinutes(header) {
  const match = String(header || '').match(/[—–-]\s*(?:TC\s*)?(\d+(?:[.,]\d+)?)\s*MIN\b/i)
  return match ? Number(match[1].replace(',', '.')) : null
}

function stripVisibleLinePrefix(line) {
  return String(line || '')
    .replace(/^[A-C]\)\s*/i, '')
    .replace(/^\d+(?:[.,]\d+)?\s*['′]?\s*[-–—]\s*\d+(?:[.,]\d+)?\s*['′]?\s*[:·-]?\s*/i, '')
    .trim()
}

function requestsRmRecord(text) {
  const value = String(text || '')
  const recordVerb =
    /\b(?:anot(?:a|ad|ar)|apunt(?:a|ad|ar)|registr(?:a|ad|ar)|guard(?:a|ad|ar)|busc(?:a|ad|ar)|consegu(?:ir|id[oa]s?)|nuevo)\b/i
  const negatedRecord =
    /\b(?:no|nunca)\b[^.!?\n]{0,60}\b(?:anot|apunt|registr|guard|busc|consegu|nuevo)\w*/i
  return value
    .split(/[\n.!?]+/)
    .some((sentence) => /\bRM\b/i.test(sentence) && recordVerb.test(sentence) && !negatedRecord.test(sentence))
}

function strengthCadenceMinutes(text) {
  const value = String(text || '')
  const everyMatch = value.match(/\b(?:cada|every)\s+(\d+(?:[.,]\d+)?)(?::(\d{2}))?\s*['′]?\s*(?:x|por)?/i)
  if (everyMatch) {
    return Number(everyMatch[1].replace(',', '.')) + (everyMatch[2] ? Number(everyMatch[2]) / 60 : 0)
  }
  const emomMatch = value.match(/\bE(\d+(?:[.,]\d+)?)(?::(\d{2}))?MOM\b/i)
  if (!emomMatch) return null
  return Number(emomMatch[1].replace(',', '.')) + (emomMatch[2] ? Number(emomMatch[2]) / 60 : 0)
}

function hasComplementaryStrengthTask(text) {
  return /\b(?:A1|A2|BISERIE|TRISERIE|SUPERSET|SUPERSERIE|ACCESORIO|COMPLEMENTARI[OA]|SEGUIDO\s+DE|DESPU[EÉ]S\s+DE\s+CADA)\b|\n\s*\+\s*\n|\s\+\s/i.test(
    String(text || ''),
  )
}

/**
 * Validaciones deterministas de una celda de sesión publicada.
 * No intenta sustituir la revisión semántica del coach.
 */
export function validateEvoSessionContract(raw, options = {}) {
  const text = String(raw || '').trim()
  if (!text || /^\(no programada esta semana\)$/i.test(text) || /^FESTIVO$/i.test(text)) {
    return { valid: true, errors: [], warnings: [] }
  }

  const errors = []
  const warnings = []
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)

  for (const line of lines) {
    if (FORBIDDEN_VISIBLE_LINE_RE.test(stripVisibleLinePrefix(line))) {
      errors.push(issue('VAL-OUTPUT-001', `Sección visible no permitida: «${line}».`))
    }
  }
  if (FULL_HOUR_TIMELINE_RE.test(text)) {
    errors.push(issue('VAL-OUTPUT-001', "No se publica un cronograma 0'-60'."))
  }

  const blocks = []
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(BLOCK_HEADER_RE)
    if (!match) continue
    blocks.push({ letter: match[1].toUpperCase(), header: match[2], lineIndex: i })
  }

  const firstLine = lines[0] || ''
  const startsWithBlock = BLOCK_HEADER_RE.test(firstLine)
  const startsWithPartUnique = PART_UNIQUE_HEADER_RE.test(firstLine)
  if (!startsWithBlock && !startsWithPartUnique) {
    errors.push(issue('VAL-OUTPUT-002', 'La sesión debe empezar en A), B), C) o PARTE ÚNICA.'))
  }

  if (startsWithPartUnique && readDurationMinutes(firstLine) == null) {
    errors.push(issue('VAL-OUTPUT-003', 'PARTE ÚNICA debe indicar su duración en el título.'))
  }

  const letters = blocks.map((block) => block.letter)
  const uniqueLetters = new Set(letters)
  if (uniqueLetters.size !== letters.length) {
    errors.push(issue('VAL-OUTPUT-002', 'Hay letras de bloque duplicadas.'))
  }
  const expectedLetters = 'ABC'.slice(0, letters.length)
  if (letters.join('') !== expectedLetters) {
    errors.push(issue('VAL-OUTPUT-002', 'Los bloques deben empezar en A) y continuar sin saltos ni desorden.'))
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const nextLine = blocks[i + 1]?.lineIndex ?? lines.length
    const body = lines.slice(block.lineIndex + 1, nextLine).join('\n')
    const title = block.header
    const isAmrap = /\bAMRAP\b/i.test(title)
    const isForTime = /\bPOR\s+TIEMPO\b/i.test(title)

    if (readDurationMinutes(title) == null) {
      errors.push(
        issue('VAL-OUTPUT-003', `El bloque debe indicar su duración en el título: «${block.letter}) ${title}».`),
      )
    }

    if (isAmrap && /\bTC\b/i.test(title)) {
      errors.push(issue('VAL-FORMAT-001', `Un AMRAP no lleva TC: «${block.letter}) ${title}».`))
    }
    if (isForTime && !/\bTC\s*\d/i.test(title)) {
      errors.push(issue('VAL-FORMAT-002', `El trabajo POR TIEMPO debe indicar TC en el título: «${block.letter}) ${title}».`))
    }
    if (isForTime && /\bAMRAP\b/i.test(body)) {
      errors.push(issue('VAL-FORMAT-001', 'Un AMRAP no puede estar rotulado como POR TIEMPO.'))
    }

    const shownDuration = readDurationMinutes(title)
    const blockText = `${title}\n${body}`
    const calculatedDuration = isEvoMetabolicIntervalBlock(blockText)
      ? intervalClockMinutesFromBlock(blockText)
      : null
    if (
      shownDuration != null &&
      calculatedDuration != null &&
      Math.abs(shownDuration - calculatedDuration) > 0.01
    ) {
      errors.push(
        issue(
          'VAL-TIME-001',
          `La duración del intervalo no cuadra: el título muestra ${shownDuration} min y la estructura suma ${calculatedDuration} min.`,
        ),
      )
    }

    const strengthText = `${title}\n${body}`
    if (isEvoStrengthBlock({ header: title, body, text: strengthText })) {
      const cadence = strengthCadenceMinutes(strengthText)
      const isWeek6RmException =
        Number(options.mesocycleWeek) === 6 &&
        /\b(?:RM|TEST|PRUEBA|RETEST|RE-TEST)\b/i.test(strengthText) &&
        cadence != null &&
        cadence <= 3
      if (cadence != null && cadence >= 3 && !hasComplementaryStrengthTask(strengthText) && !isWeek6RmException) {
        errors.push(
          issue(
            'VAL-STRENGTH-001',
            `Una cadencia de ${cadence} min en fuerza necesita un segundo movimiento o accesorio. Para un único movimiento acorta el descanso; solo las últimas series de RM de S6 pueden llegar a 3 min.`,
          ),
        )
      }
    }
  }

  if (startsWithPartUnique && isEvoMetabolicIntervalBlock(text)) {
    const shownDuration = readDurationMinutes(firstLine)
    const calculatedDuration = intervalClockMinutesFromBlock(text)
    if (
      shownDuration != null &&
      calculatedDuration != null &&
      Math.abs(shownDuration - calculatedDuration) > 0.01
    ) {
      errors.push(
        issue(
          'VAL-TIME-001',
          `La duración del intervalo no cuadra: el título muestra ${shownDuration} min y la estructura suma ${calculatedDuration} min.`,
        ),
      )
    }
  }

  if (requestsRmRecord(text) && !/\b(TEST|PRUEBA|RETEST|RE-TEST)\b/i.test(text)) {
    errors.push(issue('VAL-RECORD-001', 'Solo se registra RM en un test real.'))
  }

  if (String(options.classKey || '').toLowerCase() === 'evofit') {
    if (/fuerza\s+(?:b[aá]sica|accesible)|versi[oó]n\s+(?:f[aá]cil|light)/i.test(text)) {
      errors.push(issue('VAL-FIT-001', 'EvoFit no se define como fuerza básica, accesible o light.'))
    }
    const hasStrength = /\bFUERZA\b/i.test(text)
    const hasAccessory = /\bACCESORIOS?\b/i.test(text)
    const hasConditioning = /\b(AMRAP|INTERVALOS|POR\s+TIEMPO|TRABAJO\s+EN\s+PAREJAS|EMOM|WOD)\b/i.test(text)
    const strengthBlocks = blocks.filter((block) => /\bFUERZA\b/i.test(block.header))
    const hasTwoLongStrengthBlocks =
      strengthBlocks.length >= 2 &&
      strengthBlocks.every((block) => (readDurationMinutes(block.header) || 0) >= 12)
    const hasDeliberateTwoPartStructure = hasStrength && hasConditioning && blocks.length === 2
    if (!(hasStrength && hasAccessory && hasConditioning) && !hasTwoLongStrengthBlocks && !hasDeliberateTwoPartStructure) {
      errors.push(
        issue(
          'VAL-FIT-002',
          'EvoFit debe usar una estructura deliberada: fuerza + accesorios + acondicionamiento, dos bloques largos de fuerza o fuerza + un bloque largo de acondicionamiento.',
        ),
      )
    }
    if (blocks.some((block) => /\b(?:HABILIDAD|SKILL|T[EÉ]CNICA|PROGRESI[OÓ]N)\b/i.test(block.header))) {
      errors.push(
        issue(
          'VAL-FIT-003',
          'EvoFit no lleva un bloque específico de aprendizaje técnico o skill; utiliza directamente opciones que la persona ya domina.',
        ),
      )
    }
  }

  if (String(options.classKey || '').toLowerCase() === 'evobasics') {
    const complexFamilies = findComplexEvoBasicsFamiliesInConditioning(text)
    if (complexFamilies.length > 1) {
      warnings.push(
        issue(
          'VAL-BASICS-003',
          `El bloque de acondicionamiento de Basics acumula ${complexFamilies.length} familias complejas (${complexFamilies.join(', ')}). Mantén como máximo una y construye el resto con movimientos sencillos.`,
          'warning',
        ),
      )
    }
  }

  for (const validatorResult of [
    validateEvoMetabolicWorkRest(text),
    validateEvoStrengthRest(text),
    validateEvoVisibleSessionDuration(text, { classKey: options.classKey }),
    validateEvoSessionEquipmentCapacity(text, {
      inventory: options.inventory || EVO_INVENTORY,
      classCapacity: options.classCapacity,
      organizationText: options.organizationText,
    }),
  ]) {
    errors.push(...validatorResult.errors)
    warnings.push(...validatorResult.warnings)
  }

  warnings.push(...validateHighSetupReuse(text, options.organizationText))

  return { valid: errors.length === 0, errors, warnings }
}
