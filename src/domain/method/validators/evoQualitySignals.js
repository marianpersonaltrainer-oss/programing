const NUMBER_WORDS = new Map([
  ['un', '1'],
  ['una', '1'],
  ['uno', '1'],
  ['dos', '2'],
  ['tres', '3'],
  ['cuatro', '4'],
  ['cinco', '5'],
  ['seis', '6'],
  ['siete', '7'],
  ['ocho', '8'],
  ['nueve', '9'],
  ['diez', '10'],
])

const DURATION_TOKEN_SOURCE = String.raw`(?:\d+(?:[.,]\d+)?\s*['’′]\s*\d+(?:[.,]\d+)?\s*(?:['’′]{2}|["”″]|seg(?:undos?)?|s\b)|\d{1,3}\s*:\s*\d{2}|\d+(?:[.,]\d+)?\s*(?:min(?:utos?)?|mins?)|\d+(?:[.,]\d+)?\s*(?:seg(?:undos?)?|s\b|['’′]{2}|["”″])|\d+(?:[.,]\d+)?\s*['’′](?!['’′]))`
const REST_LABEL_SOURCE = String.raw`(?:descanso|descansar|descansa|descansando|pausa|recuperaci[oó]n|recuperar|recupera|recuperando|cambio|cambiar|transici[oó]n|transicionar|rest|off)`
const WORK_LABEL_SOURCE = String.raw`(?:trabajo|trabajar|trabaja|trabajando|work|on)`
const PAIR_SEPARATOR_SOURCE = String.raw`[\s,:;.+\/|–—-]*(?:(?:seguid[oa]s?\s+(?:de|por)|y\s+(?:despu[eé]s|luego)|despu[eé]s(?:\s+de)?|luego|a\s+continuaci[oó]n)\s*)?`

function issue(code, message, severity = 'error') {
  return { code, message, severity }
}

function replaceNumberWordsBeforeUnits(value) {
  return String(value || '').replace(
    /\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?=(?:min(?:uto)?s?|seg(?:undo)?s?)\b)/gi,
    (match, word) => `${NUMBER_WORDS.get(String(word).toLowerCase()) || word} `,
  )
}

/**
 * Convierte una duración escrita de forma habitual en segundos.
 * Admite 2', 45'', 2'30'', 2:30, 2 min y 45 segundos.
 */
export function parseEvoDurationSeconds(raw) {
  const value = replaceNumberWordsBeforeUnits(raw).trim().toLowerCase().replace(',', '.')
  if (!value) return null

  const compoundQuote = value.match(
    /^(\d+(?:\.\d+)?)\s*['’′]\s*(\d+(?:\.\d+)?)\s*(?:['’′]{2}|["”″]|seg(?:undos?)?|s\b)/i,
  )
  if (compoundQuote) return Number(compoundQuote[1]) * 60 + Number(compoundQuote[2])

  const clock = value.match(/^(\d{1,3})\s*:\s*(\d{2})/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])

  const seconds = value.match(
    /^(\d+(?:\.\d+)?)\s*(?:seg(?:undos?)?|s\b|['’′]{2}|["”″])/i,
  )
  if (seconds) return Number(seconds[1])

  const minutes = value.match(
    /^(\d+(?:\.\d+)?)\s*(?:min(?:utos?)?|mins?|['’′](?!['’′]))/i,
  )
  if (minutes) return Number(minutes[1]) * 60

  return null
}

function durationTokens(value) {
  const normalized = replaceNumberWordsBeforeUnits(value)
  const tokenRe = new RegExp(DURATION_TOKEN_SOURCE, 'gi')
  return [...normalized.matchAll(tokenRe)]
    .map((match) => ({
      raw: match[0],
      seconds: parseEvoDurationSeconds(match[0]),
      index: match.index ?? 0,
    }))
    .filter((entry) => Number.isFinite(entry.seconds))
}

function addWorkRestPair(target, match, workIndex, restIndex, source) {
  const workSeconds = parseEvoDurationSeconds(match[workIndex])
  const restSeconds = parseEvoDurationSeconds(match[restIndex])
  if (!(workSeconds > 0) || !(restSeconds >= 0)) return
  const key = `${match.index ?? 0}:${workSeconds}:${restSeconds}`
  if (target.some((entry) => entry.key === key)) return
  target.push({
    key,
    workSeconds,
    restSeconds,
    source,
    raw: match[0],
    index: match.index ?? 0,
  })
}

/**
 * Extrae parejas trabajo/descanso aunque el texto use orden, idioma o signos distintos.
 */
export function extractEvoWorkRestPairs(raw) {
  const text = replaceNumberWordsBeforeUnits(raw)
  const pairs = []
  const patterns = [
    {
      source: 'duration_labels',
      re: new RegExp(
        `(${DURATION_TOKEN_SOURCE})\\s*(?:de\\s*)?${WORK_LABEL_SOURCE}\\b${PAIR_SEPARATOR_SOURCE}(?:y\\s*)?(${DURATION_TOKEN_SOURCE})\\s*(?:(?:de|para)\\s*)?${REST_LABEL_SOURCE}\\b`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
    {
      source: 'labels_duration',
      re: new RegExp(
        `${WORK_LABEL_SOURCE}\\b\\s*(?:durante|de|:)?\\s*(${DURATION_TOKEN_SOURCE})${PAIR_SEPARATOR_SOURCE}(?:y\\s*)?${REST_LABEL_SOURCE}\\b\\s*(?:durante|de|:)?\\s*(${DURATION_TOKEN_SOURCE})`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
    {
      source: 'duration_work_rest_duration',
      re: new RegExp(
        `(${DURATION_TOKEN_SOURCE})\\s*(?:de\\s*)?${WORK_LABEL_SOURCE}\\b${PAIR_SEPARATOR_SOURCE}(?:y\\s*)?${REST_LABEL_SOURCE}\\b\\s*(?:durante|de|:)?\\s*(${DURATION_TOKEN_SOURCE})`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
    {
      source: 'work_duration_duration_rest',
      re: new RegExp(
        `${WORK_LABEL_SOURCE}\\b\\s*(?:durante|de|:)?\\s*(${DURATION_TOKEN_SOURCE})${PAIR_SEPARATOR_SOURCE}(?:y\\s*)?(${DURATION_TOKEN_SOURCE})\\s*(?:(?:de|para)\\s*)?${REST_LABEL_SOURCE}\\b`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
    {
      source: 'activity_duration_rest',
      re: new RegExp(
        `(${DURATION_TOKEN_SOURCE})[ \\t]+(?:(?!${REST_LABEL_SOURCE}\\b)[^.;\\n]){1,50}?(?:[\\/+|–—-]|\\bcon\\b|\\by\\b)\\s*(${DURATION_TOKEN_SOURCE})\\s*(?:(?:de|para)\\s*)?${REST_LABEL_SOURCE}\\b`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
    {
      source: 'work_rest_prefix',
      re: new RegExp(
        `(?:work\\s*[\\/|]\\s*rest|trabajo\\s*[\\/|]\\s*descanso)\\s*:?\\s*(${DURATION_TOKEN_SOURCE})\\s*[\\/|]\\s*(${DURATION_TOKEN_SOURCE})`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
    {
      source: 'on_off',
      re: new RegExp(
        `(${DURATION_TOKEN_SOURCE})\\s*ON\\b\\s*[\\/|+–—-]\\s*(${DURATION_TOKEN_SOURCE})\\s*OFF\\b`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
    {
      source: 'on_off_prefix',
      re: new RegExp(
        `\\bON\\s*(${DURATION_TOKEN_SOURCE})\\s*[\\/|+–—-]\\s*OFF\\s*(${DURATION_TOKEN_SOURCE})`,
        'gi',
      ),
      work: 1,
      rest: 2,
    },
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.re)) {
      addWorkRestPair(pairs, match, pattern.work, pattern.rest, pattern.source)
    }
  }

  const intervalContext =
    /\b(?:INTERVALOS?|ACONDICIONAMIENTO|METCON|FINISHER|WOD|ON\s*\/\s*OFF|WORK\s*\/\s*REST|TABATA|E\d+(?:[.,]\d+)?MOM|EMOM)\b/i.test(
      text,
    ) ||
    new RegExp(`\\b\\d+\\s*[x×]\\s*${DURATION_TOKEN_SOURCE}\\s*[\\/|]\\s*${DURATION_TOKEN_SOURCE}`, 'i').test(
      text,
    )
  if (intervalContext) {
    const lines = text.split('\n').map((line) => line.trim())
    const workLineRe = new RegExp(
      `^(${DURATION_TOKEN_SOURCE})\\s+(?!${REST_LABEL_SOURCE}\\b).+$`,
      'i',
    )
    const restLineRe = new RegExp(
      `^(${DURATION_TOKEN_SOURCE})\\s*(?:(?:de|para)\\s*)?${REST_LABEL_SOURCE}\\b`,
      'i',
    )
    for (let index = 0; index < lines.length - 1; index += 1) {
      const workLine = lines[index].match(workLineRe)
      const restLine = lines[index + 1].match(restLineRe)
      if (!workLine || !restLine) continue
      const synthetic = [lines.slice(index, index + 2).join('\n'), workLine[1], restLine[1]]
      synthetic.index = text.indexOf(lines[index])
      addWorkRestPair(pairs, synthetic, 1, 2, 'multiline_activity_rest')
    }
  }
  if (intervalContext) {
    const barePair = new RegExp(
      `(${DURATION_TOKEN_SOURCE})\\s*(?:ON\\s*)?[\\/|]\\s*(${DURATION_TOKEN_SOURCE})\\s*(?:OFF\\s*)?`,
      'gi',
    )
    for (const match of text.matchAll(barePair)) {
      addWorkRestPair(pairs, match, 1, 2, 'bare_interval_pair')
    }
  }

  const unique = new Map()
  for (const { key: _key, ...entry } of pairs) {
    const signature = `${entry.workSeconds}:${entry.restSeconds}`
    if (!unique.has(signature)) unique.set(signature, entry)
  }
  return [...unique.values()]
}

export function extractEvoRestDurations(raw) {
  const text = replaceNumberWordsBeforeUnits(raw)
  const found = []
  const beforeRe = new RegExp(
    `\\b${REST_LABEL_SOURCE}\\b(?:\\s+entre\\s+series)?[^.\\n;]{0,45}`,
    'gi',
  )
  const afterRe = new RegExp(
    `(?:${DURATION_TOKEN_SOURCE})(?:\\s*(?:[-–—]|a)\\s*(?:${DURATION_TOKEN_SOURCE}))?\\s*(?:de\\s*)?${REST_LABEL_SOURCE}\\b`,
    'gi',
  )
  const betweenSetsRe = new RegExp(
    `(?:${DURATION_TOKEN_SOURCE})(?:\\s*(?:[-–—]|a)\\s*(?:${DURATION_TOKEN_SOURCE}))?\\s+entre\\s+(?:series|rondas)\\b`,
    'gi',
  )

  for (const match of text.matchAll(beforeRe)) {
    for (const token of durationTokens(match[0])) {
      found.push({ ...token, rawContext: match[0] })
    }
  }
  for (const match of text.matchAll(afterRe)) {
    for (const token of durationTokens(match[0])) {
      found.push({ ...token, rawContext: match[0] })
    }
  }
  for (const match of text.matchAll(betweenSetsRe)) {
    for (const token of durationTokens(match[0])) {
      found.push({ ...token, rawContext: match[0] })
    }
  }

  const unique = new Map()
  for (const entry of found) {
    unique.set(`${entry.seconds}:${entry.rawContext}`, entry)
  }
  return [...unique.values()]
}

function splitVisibleBlocks(raw) {
  const lines = String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const headers = []
  for (let index = 0; index < lines.length; index += 1) {
    if (/^[ABC]\)\s*/i.test(lines[index]) || /^PARTE\s+[UÚ]NICA\b/i.test(lines[index])) {
      headers.push({ index, header: lines[index] })
    }
  }
  if (!headers.length) return [{ header: '', body: lines.join('\n'), text: lines.join('\n') }]
  return headers.map((item, position) => {
    const end = headers[position + 1]?.index ?? lines.length
    return {
      header: item.header,
      body: lines.slice(item.index + 1, end).join('\n'),
      text: lines.slice(item.index, end).join('\n'),
    }
  })
}

const EXPLICIT_STRENGTH_HEADER_RE =
  /\b(?:FUERZA|STRENGTH|T[EÉ]CNICA\s+DE\s+FUERZA)\b/i
const ACCESSORY_HEADER_RE = /\b(?:ACCESORIOS?|COMPLEMENTARI[OA])\b/i
const EXPLICIT_CONDITIONING_RE =
  /\b(?:AMRAP|FOR\s+TIME|POR\s+TIEMPO|WOD|ACONDICIONAMIENTO|METCON|FINISHER|INTERVALOS?|TABATA|CHIPPER|LADDER|ESCALERA)\b/i
const MAIN_STRENGTH_MOVEMENT_RE =
  /\b(?:back|front|overhead|box|zercher)\s+squats?\b|\b(?:(?:hang|power|squat|muscle)\s+)?(?:clean(?:\s*(?:&|and)\s*jerk)?|snatch|jerk)s?\b|\b(?:sentadilla(?:s)?(?:\s+(?:trasera|frontal|sobre\s+la\s+cabeza))?|deadlifts?|peso\s+muerto|bench\s+press|press\s+(?:de\s+)?banca|floor\s+press|strict\s+press|press\s+estricto|military\s+press|press\s+militar|overhead\s+press|push\s+press|hip\s+thrust|weighted\s+(?:pull[\s-]?ups?|chin[\s-]?ups?)|dominadas?\s+lastradas?|barbell\s+rows?|remo\s+con\s+barra|cargadas?(?:\s+y\s+(?:envi[oó]n|jerk))?|arrancadas?|envi[oó]n|dos\s+tiempos?)\b/i
const STRENGTH_LOAD_RE =
  /(?:@\s*)?\b\d{2,3}(?:[.,]\d+)?\s*%\s*(?:1?\s*RM)?\b|(?:@\s*)?\b(?:RPE|RIR)\s*[-:]?\s*\d(?:[.,]\d+)?\b|\b\d+(?:[.,]\d+)?\s*RM\b|\b(?:carga|peso)\s+(?:pesad[oa]|moderad[oa]|objetiv[oa])\b/i
const STRENGTH_SET_RE =
  /\b\d+\s*[x×]\s*\d{1,2}\b|\b\d+\s+(?:series?|sets?)\s*(?:x|de)?\s*\d{1,2}\b|\b\d{1,2}\s+(?:reps?|repeticiones?)\s*(?:x|durante)\s*\d+\s+(?:series?|sets?)\b/i
const STRENGTH_CLOCK_SETS_RE =
  /\b(?:cada|every)\s+(?:\d+(?:[.,]\d+)?\s*(?:min(?:utos?)?|['’′])|\d{1,2}:\d{2})[\s\S]{0,45}?\b(?:x\s*)?\d+\s*(?:series?|sets?)\b|\bE\d+(?:[.,]\d+)?MOM\b[\s\S]{0,45}?\b\d+\s*(?:series?|sets?)\b/i
const LOADED_SETS_HEADER_RE =
  /\b(?:HIPERTROFIA|POTENCIA|T[EÉ]CNICA|MOVIMIENTO\s+PRINCIPAL|B[AÁ]SICO|TREN\s+(?:SUPERIOR|INFERIOR)|UPPER|LOWER)\b/i

/**
 * Reconoce fuerza por intención y prescripción, no solo por el rótulo del bloque.
 * Un formato inequívocamente metabólico prevalece para no convertir en fuerza un
 * AMRAP que simplemente contiene sentadillas con carga.
 */
export function isEvoStrengthBlock(block) {
  const header = String(block?.header || '')
  const text = String(block?.text || `${header}\n${block?.body || ''}`)

  const hasMainMovement = MAIN_STRENGTH_MOVEMENT_RE.test(text)
  const hasLoad = STRENGTH_LOAD_RE.test(text)
  const hasSetPrescription = STRENGTH_SET_RE.test(text)
  const hasStrengthClock = STRENGTH_CLOCK_SETS_RE.test(text)
  const hasLoadedSets = hasLoad && (hasSetPrescription || hasStrengthClock)
  const hasExplicitRest = extractEvoRestDurations(text).length > 0
  const hasWorkRestPair = extractEvoWorkRestPairs(text).length > 0

  if (EXPLICIT_CONDITIONING_RE.test(text)) return false
  if (EXPLICIT_STRENGTH_HEADER_RE.test(header)) {
    // El rótulo «FUERZA» no puede ocultar un ON/OFF metabólico. Solo conserva
    // la clasificación de fuerza si existe una prescripción real de carga/series.
    return !hasWorkRestPair || hasLoadedSets || hasStrengthClock
  }
  return (
    hasLoadedSets &&
    (hasMainMovement || hasExplicitRest || LOADED_SETS_HEADER_RE.test(header))
  )
}

function isPassiveIgyg(text) {
  if (!/\bIGYG\b|I\s+GO\s+YOU\s+GO/i.test(text)) return false
  return !/\b(?:sin\s+espera|trabajo\s+simult[aá]neo|tarea\s+paralela|mientras\s+(?:la\s+)?pareja\s+(?:hace|trabaja))\b/i.test(
    text,
  )
}

function isTimedStations(text) {
  const value = String(text || '')
  if (!/\bestaciones?\b/i.test(value)) return false
  const body = value.split('\n').slice(1).join('\n')
  const explicitStationClock = new RegExp(
    `\\b(?:cada\\s+estaci[oó]n|estaciones?\\s+(?:de|a))\\s*(?:${DURATION_TOKEN_SOURCE})`,
    'i',
  )
  const hasRecoverySignal =
    /\b(?:descanso|pausa|recuperaci[oó]n)\b/i.test(body) &&
    !/\bsin\s+(?:cambios?|transici[oó]n|descanso|pausas?|recuperaci[oó]n)\b/i.test(body)
  return (
    explicitStationClock.test(body) ||
    extractEvoWorkRestPairs(body).length > 0 ||
    hasRecoverySignal
  )
}

export function isEvoMetabolicIntervalBlock(raw) {
  const text = String(raw || '')
  if (!text.trim()) return false
  const header = text.split('\n')[0] || ''
  const explicitlyMetabolic =
    extractEvoWorkRestPairs(text).length > 0 ||
    /\b(?:INTERVALOS?|TABATA|ON\s*\/\s*OFF|WORK\s*\/\s*REST)\b/i.test(text)
  if (
    isEvoStrengthBlock({ header, text }) &&
    !/\b(?:INTERVALOS?|ACONDICIONAMIENTO|METCON|FINISHER|WOD|ON\s*\/\s*OFF|WORK\s*\/\s*REST|TABATA)\b/i.test(
      text,
    )
  ) {
    return false
  }
  if (
    /\b(?:T[EÉ]CNICA|SKILL|DRILLS?|HABILIDAD|APRENDIZAJE)\b/i.test(header) &&
    !/\b(?:INTERVALOS?|ACONDICIONAMIENTO|METCON|FINISHER|WOD|ON\s*\/\s*OFF|WORK\s*\/\s*REST|TABATA)\b/i.test(
      text,
    )
  ) {
    return false
  }
  if (extractEvoWorkRestPairs(text).length) return true
  if (/\b(?:INTERVALOS?|TABATA|ON\s*\/\s*OFF|WORK\s*\/\s*REST)\b/i.test(text)) return true
  if (isPassiveIgyg(text) || isTimedStations(text)) return true
  if (
    /\b(?:cada|every)\s+(?:\d+(?:[.,]\d+)?\s*(?:min(?:utos?)?|['’′])|\d{1,2}:\d{2})[\s\S]{0,100}?\b(?:descansa|descanso|pausa|recupera|restante|rest)\b/i.test(
      text,
    )
  ) {
    return true
  }
  if (
    /\b(?:E\d+(?:[.,]\d+)?MOM|EMOM)\b/i.test(text) &&
    !/\b(?:FUERZA|STRENGTH|T[EÉ]CNICA|SKILL|DRILLS?|HABILIDAD|APRENDIZAJE)\b/i.test(
      header,
    )
  ) {
    return true
  }
  return false
}

export function isEvoMetabolicIntervalSession(raw) {
  return splitVisibleBlocks(raw).some((block) => isEvoMetabolicIntervalBlock(block.text))
}

export function countEvoMetabolicIntervalBlocks(raw) {
  return splitVisibleBlocks(raw).filter((block) => isEvoMetabolicIntervalBlock(block.text)).length
}

function maxMetabolicRestSeconds(workSeconds, text) {
  const maximalPower =
    workSeconds <= 60 &&
    /\b(?:sprint|potencia\s+m[aá]xima|all[\s-]?out|esfuerzo\s+m[aá]ximo)\b/i.test(text)
  if (workSeconds <= 30) return maximalPower ? 60 : 30
  if (workSeconds <= 60) return maximalPower ? 60 : 40
  if (workSeconds <= 90) return 45
  if (workSeconds <= 120) return 45
  if (workSeconds <= 180) return 60
  if (workSeconds <= 300) return 60
  return 90
}

function readableSeconds(seconds) {
  if (seconds % 60 === 0) return `${seconds / 60}'`
  if (seconds > 60) return `${Math.floor(seconds / 60)}'${seconds % 60}''`
  return `${seconds}''`
}

export function validateEvoMetabolicWorkRest(raw) {
  const errors = []
  const warnings = []
  const blocks = splitVisibleBlocks(raw)
  const intervalBlocks = blocks.filter((block) => isEvoMetabolicIntervalBlock(block.text))
  if (intervalBlocks.length > 1) {
    errors.push(
      issue(
        'VAL-DENSITY-003',
        `La sesión contiene ${intervalBlocks.length} bloques interválicos metabólicos. El Método EVO admite un único bloque interválico principal por sesión.`,
      ),
    )
  }
  for (const block of intervalBlocks) {
    const pairs = extractEvoWorkRestPairs(block.text)
    for (const pair of pairs) {
      const maxRest = maxMetabolicRestSeconds(pair.workSeconds, block.text)
      if (pair.workSeconds > 300 && pair.restSeconds > 0) {
        errors.push(
          issue(
            'VAL-DENSITY-001',
            `Un esfuerzo de ${readableSeconds(pair.workSeconds)} no debe repetirse como ON/OFF con pausas. Usa trabajo continuo o separa bloques distintos.`,
          ),
        )
      } else if (pair.restSeconds > maxRest) {
        errors.push(
          issue(
            'VAL-DENSITY-001',
            `Descanso metabólico excesivo: ${readableSeconds(pair.workSeconds)} de trabajo admite como máximo ${readableSeconds(maxRest)} de descanso; se han programado ${readableSeconds(pair.restSeconds)}.`,
          ),
        )
      }
    }

    const hidesRemainingRest =
      /\b(?:(?:cada|every)\s+(?:\d+(?:[.,]\d+)?\s*(?:min(?:utos?)?|['’′])|\d{1,2}:\d{2})|E\d+(?:[.,]\d+)?MOM)[\s\S]{0,100}?\b(?:descansa|descansar|descanso|pausa|recupera|recuperar)[\s\S]{0,35}\b(?:restante|resto)\b/i.test(
        block.text,
      )
    if (hidesRemainingRest && pairs.length === 0) {
      errors.push(
        issue(
          'VAL-DENSITY-002',
          'El intervalo indica «descansar el tiempo restante», pero no fija una duración de trabajo verificable. Define trabajo y descanso para evitar una espera pasiva excesiva.',
        ),
      )
    }
  }
  return { errors, warnings }
}

function repetitionsPerSet(text) {
  const values = []
  for (const match of String(text || '').matchAll(/\b\d+\s*[x×]\s*(\d{1,2})\b/gi)) {
    values.push(Number(match[1]))
  }
  for (const match of String(text || '').matchAll(/\b(\d{1,2})\s*(?:reps?|repeticiones?)\b/gi)) {
    values.push(Number(match[1]))
  }
  return values.length ? Math.max(...values) : null
}

function highestPercentage(text) {
  const values = [...String(text || '').matchAll(/(?:@|al\s+)?(\d{2,3}(?:[.,]\d+)?)\s*%\s*(?:RM)?/gi)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter(Number.isFinite)
  return values.length ? Math.max(...values) : null
}

function strengthRestLimitSeconds(text, header = '') {
  const reps = repetitionsPerSet(text)
  const percentage = highestPercentage(text)
  const accessoryBlock = /\b(?:ACCESORIOS?|COMPLEMENTARI[OA])\b/i.test(header)
  if (accessoryBlock && reps != null && reps >= 6) return 75
  if (reps != null && reps >= 9) return 75
  if (reps != null && reps >= 6) return 120
  if (
    (percentage != null && percentage > 95) ||
    /\b(?:intento\s+real|m[aá]ximo\s+real|superior\s+al\s+95)\b/i.test(text)
  ) {
    return 300
  }
  if (
    (percentage != null && percentage >= 86) ||
    (reps != null && reps <= 3 && /\b(?:pico|pesad[oa]|RIR\s*[01])\b/i.test(text))
  ) {
    return 240
  }
  if (
    (percentage != null && percentage >= 76) ||
    (reps != null && reps <= 5) ||
    /\bRIR\s*[12]\b/i.test(text)
  ) {
    return 150
  }
  if (
    (percentage != null && percentage >= 65) ||
    (reps != null && reps >= 5 && reps <= 8) ||
    /\bmoderad[oa]\b/i.test(text)
  ) {
    return 120
  }
  return 75
}

export function validateEvoStrengthRest(raw) {
  const errors = []
  const warnings = []
  for (const block of splitVisibleBlocks(raw)) {
    if (!isEvoStrengthBlock(block) && !ACCESSORY_HEADER_RE.test(block.header)) continue
    const rests = extractEvoRestDurations(block.text)
    if (!rests.length) continue
    const maximumRest = Math.max(...rests.map((entry) => entry.seconds))
    const allowedRest = strengthRestLimitSeconds(block.text, block.header)
    if (maximumRest > allowedRest) {
      errors.push(
        issue(
          'VAL-STRENGTH-002',
          `El descanso de ${readableSeconds(maximumRest)} es demasiado largo para las repeticiones y la intensidad indicadas; el límite operativo de este bloque es ${readableSeconds(allowedRest)}.`,
        ),
      )
    }
  }
  return { errors, warnings }
}

function readHeaderDurationMinutes(header) {
  const match = String(header || '').match(
    /[—–-]\s*(?:TC\s*)?(\d+(?:[.,]\d+)?)\s*(?:MIN(?:UTOS?)?|['’′])/i,
  )
  return match ? Number(match[1].replace(',', '.')) : null
}

export function readEvoVisibleSessionDuration(raw) {
  const blocks = splitVisibleBlocks(raw)
  const durations = blocks
    .map((block) => readHeaderDurationMinutes(block.header))
    .filter((value) => Number.isFinite(value))
  return {
    blockCount: blocks.length,
    durations,
    totalMinutes: durations.reduce((sum, value) => sum + value, 0),
    complete: durations.length === blocks.length,
  }
}

export function validateEvoVisibleSessionDuration(raw, options = {}) {
  const errors = []
  const warnings = []
  const duration = readEvoVisibleSessionDuration(raw)
  if (!duration.complete || !duration.durations.length) return { errors, warnings }
  if (duration.blockCount > 1 && duration.totalMinutes > 33) {
    errors.push(
      issue(
        'VAL-TIME-002',
        `Las partes visibles suman ${duration.totalMinutes} min. Una sesión con varias partes debe quedar normalmente en 30-32 min y no superar 33 min.`,
      ),
    )
  } else if (duration.blockCount === 1 && duration.totalMinutes > 42) {
    errors.push(
      issue(
        'VAL-TIME-002',
        `La parte única dura ${duration.totalMinutes} min y supera el máximo operativo de 42 min.`,
      ),
    )
  }
  if (duration.blockCount > 1 && duration.totalMinutes < 28) {
    warnings.push(
      issue(
        'VAL-TIME-003',
        `Las partes visibles suman solo ${duration.totalMinutes} min. Revisa que exista trabajo suficiente: una sesión multipartes suele ocupar 30-32 min visibles.`,
        'warning',
      ),
    )
  }
  if (
    String(options.classKey || '').toLowerCase() === 'evohybrix' &&
    duration.totalMinutes < 35
  ) {
    warnings.push(
      issue(
        'VAL-TIME-003',
        `EvoHybrix solo contiene ${duration.totalMinutes} min visibles. Su experiencia larga necesita normalmente al menos 35-40 min de trabajo programado.`,
        'warning',
      ),
    )
  }
  return { errors, warnings }
}

function explicitPairCount(text, classCapacity) {
  const match = String(text || '').match(/\b(\d{1,2})\s*parejas?\b/i)
  if (match) return Number(match[1])
  if (/\b(?:parejas?|partner|IGYG)\b/i.test(text)) return Math.ceil(classCapacity / 2)
  return null
}

function hasSerialResourceFlow(text) {
  return /\b(?:relevos?|salidas?\s+escalonadas?|tandas?|turnos?|oleadas?)\b/i.test(
    text,
  )
}

function resourcesHaveSerialFlow(text, resources) {
  const lines = String(text || '').split('\n')
  return (
    resources.length > 0 &&
    resources.every((resource) =>
      lines.some((line) => resource.re.test(line) && hasSerialResourceFlow(line)),
    )
  )
}

function stationResourcePlan(text, resources) {
  const value = String(text || '')
  if (!/\bestaciones?\b/i.test(value)) return null
  const stationLines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-E][.)]\s+/i.test(line))
  if (stationLines.length < 2) return null
  return resources.every((resource) => {
    const required = stationLines.filter((line) => resource.re.test(line)).length
    return required <= resource.amount
  })
}

/**
 * Bloquea esperas evidentes para una clase de referencia de diez personas.
 * Las estaciones o salidas escalonadas explícitas reducen la demanda simultánea.
 */
export function validateEvoSessionEquipmentCapacity(raw, options = {}) {
  const text = String(raw || '')
  const inventory = options.inventory || {}
  const classCapacity = Number(options.classCapacity) || 10
  const machines = inventory.machines || {}
  const resourceCatalog = [
    { key: 'RowErg', amount: Number(machines.rowerg) || 0, re: /\bRowErg\b|\bremo\s+erg[oó]metro\b/i },
    { key: 'Bike', amount: Number(machines.bike) || 0, re: /\b(?:BikeErg|Air\s*Bike|Assault\s*Bike|Bike|bicicleta)\b/i },
    { key: 'SkiErg', amount: Number(machines.skierg) || 0, re: /\bSki\s*Erg\b|\bSkiErg\b/i },
    { key: 'trineo', amount: Number(inventory.sled?.total) || 0, re: /\b(?:trineo|sled)\b/i },
    { key: 'banco', amount: Number(inventory.other?.benches) || 0, re: /\b(?:Bench\s+Press|banco)\b/i },
  ]
  const errors = []
  const visibleBlocks = splitVisibleBlocks(text)

  for (const block of visibleBlocks) {
    const resources = resourceCatalog.filter((resource) => resource.re.test(block.text))
    if (!resources.length) continue
    const externalOrganization = String(options.organizationText || '')
    const organizationText = [block.text, externalOrganization].filter(Boolean).join('\n')
    const blockLetter = String(block.header || '').match(/^([A-C])\)/i)?.[1]?.toUpperCase() || ''
    const externalBlockReferences = [
      ...externalOrganization.matchAll(/\b(?:bloque|parte)\s+([A-C])\b/gi),
    ].map((match) => match[1].toUpperCase())
    const externalAppliesToBlock =
      visibleBlocks.length === 1 ||
      (blockLetter &&
        externalBlockReferences.includes(blockLetter) &&
        resources.some((resource) => resource.re.test(externalOrganization)))
    const externalSerialFlowApplies =
      externalAppliesToBlock &&
      resourcesHaveSerialFlow(externalOrganization, resources)
    const internalStationPlan = stationResourcePlan(block.text, resources)
    const externalStationPlan = externalAppliesToBlock
      ? stationResourcePlan(externalOrganization, resources)
      : null
    if (
      resourcesHaveSerialFlow(block.text, resources) ||
      internalStationPlan === true ||
      externalStationPlan === true ||
      externalSerialFlowApplies
    ) {
      continue
    }

    const individual =
      /\b(?:individual|cada\s+(?:persona|alumn[oa])|todos?\s+a\s+la\s+vez)\b/i.test(organizationText)
    const pairs = explicitPairCount(organizationText, classCapacity)
    const requiredPosts = individual ? classCapacity : pairs || classCapacity
    const usesOnlyErgs = resources.every((resource) => ['RowErg', 'Bike', 'SkiErg'].includes(resource.key))
    const presentsErgsAsAlternatives =
      usesOnlyErgs &&
      resources.length > 1 &&
      /\b(?:repart(?:ir|idas?)|elegir|alternar|RowErg\s*[/|]\s*(?:Bike|SkiErg)|m[aá]quinas?\s+disponibles)\b/i.test(
        organizationText,
      )
    const availablePosts = presentsErgsAsAlternatives
      ? resources.reduce((sum, resource) => sum + resource.amount, 0)
      : Math.min(...resources.map((resource) => resource.amount))

    if (availablePosts >= requiredPosts) continue
    errors.push(
      issue(
        'VAL-MATERIAL-001',
        `${resources.map((resource) => `${resource.key} (${resource.amount})`).join(', ')} no cubre ${requiredPosts} puestos simultáneos para ${classCapacity} personas en ese bloque. Organiza estaciones, relevos, turnos o salidas escalonadas reales.`,
      ),
    )
  }
  return { errors, warnings: [] }
}

function experienceBucket(text) {
  if (/\brelevos?\b/i.test(text)) return 'relay'
  if (/\b(?:equipos?|team)\b/i.test(text)) return 'team'
  if (/\bestaciones?\b/i.test(text)) return 'stations'
  if (/\b(?:parejas?|partner|IGYG)\b/i.test(text)) return 'partner'
  return 'individual'
}

function strengthFormatBucket(text) {
  const cadence = String(text || '').match(/\b(?:E(\d+(?:[.,]\d+)?)MOM|cada\s+(\d+(?:[.,]\d+)?)\s*['’′]?)/i)
  if (cadence) return `clock_${String(cadence[1] || cadence[2]).replace(',', '.')}`
  if (/\b(?:biserie|superserie|superset|A1\b.*A2\b)\b/is.test(text)) return 'superset'
  if (/\b(?:cluster|rest[\s-]*pause)\b/i.test(text)) return 'cluster'
  if (/\b(?:onda|wave)\b/i.test(text)) return 'wave'
  return 'sets'
}

function conditioningFormatBucket(text) {
  const pair = extractEvoWorkRestPairs(text)[0]
  if (pair) return `interval_${pair.workSeconds}_${pair.restSeconds}`
  if (/\bAMRAP\b/i.test(text)) return 'amrap'
  if (/\b(?:POR\s+TIEMPO|FOR\s+TIME|TC\s*\d)\b/i.test(text)) return 'for_time'
  if (/\b(?:CHIPPER|LADDER|ESCALERA)\b/i.test(text)) return 'long_task'
  if (isEvoMetabolicIntervalBlock(text)) return 'interval_other'
  if (/\b(?:CALIDAD|FOR\s+QUALITY|CONTINUO)\b/i.test(text)) return 'continuous'
  return 'other'
}

function movementPatternBucket(text) {
  const value = String(text || '')
  const patterns = []
  const add = (label, re) => {
    if (re.test(value)) patterns.push(label)
  }
  add('squat', /\b(?:back|front|overhead|goblet|air)\s+squat\b|\bsentadilla\b|\bthrusters?\b|\bwall\s*balls?\b/i)
  add('hinge', /\b(?:deadlift|peso\s+muerto|RDL|good\s+morning|swing)s?\b/i)
  add('vertical_push', /\b(?:strict|push|shoulder|military)\s+press\b|\bpress\s+(?:estricto|militar)\b|\bjerks?\b/i)
  add('horizontal_push', /\b(?:bench|floor)\s+press\b|\bpush[\s-]?ups?\b|\bfondos?\b/i)
  add('vertical_pull', /\b(?:pull[\s-]?ups?|chin[\s-]?ups?|dominadas?|lat\s+pull)\b/i)
  add('horizontal_pull', /\b(?:ring|barbell|dumbbell|db|cable|landmine)\s+rows?\b|\bremos?\b/i)
  add('lunge', /\b(?:lunges?|zancadas?|split\s+squat|step[\s-]?ups?)\b/i)
  add('olympic', /\b(?:clean|snatch|cargada|arrancada|envi[oó]n)\b/i)
  add('carry', /\b(?:carry|carries|farmer|suitcase|front\s+rack\s+walk)\b/i)
  return patterns.length ? [...new Set(patterns)].sort().join('+') : 'other'
}

export function buildEvoSessionArchitecture(raw) {
  const text = String(raw || '')
  const blocks = splitVisibleBlocks(text)
  const exactBlocks = []
  const skeletonBlocks = []
  const shapeBlocks = []
  for (const block of blocks) {
    if (isEvoStrengthBlock(block)) {
      exactBlocks.push(`strength_${strengthFormatBucket(block.text)}`)
      skeletonBlocks.push('strength')
      shapeBlocks.push('strength')
    } else if (/\b(?:SKILL|T[EÉ]CNICA|HABILIDAD|APRENDIZAJE)\b/i.test(block.header)) {
      exactBlocks.push('skill')
      skeletonBlocks.push('skill')
      shapeBlocks.push('skill')
    } else if (/\b(?:ACCESORIOS?|COMPLEMENTARI[OA])\b/i.test(block.header)) {
      exactBlocks.push('accessory')
      skeletonBlocks.push('accessory')
      shapeBlocks.push('accessory')
    } else {
      const format = conditioningFormatBucket(block.text)
      exactBlocks.push(format)
      skeletonBlocks.push(format.startsWith('interval_') ? 'interval' : format)
      shapeBlocks.push('conditioning')
    }
  }
  const experience = experienceBucket(text)
  return {
    exact: `${exactBlocks.join('>')}|${experience}`,
    skeleton: `${skeletonBlocks.join('>')}|${experience}`,
    shape: shapeBlocks.join('>'),
    pattern: movementPatternBucket(text),
    blockCount: blocks.length,
    experience,
    isInterval: isEvoMetabolicIntervalSession(text),
  }
}

export function hasEvoOlympicFamily(raw) {
  return /\b(?:(?:hang|power|squat|muscle|split|push|dumbbell|db|barbell)\s+)*(?:clean|snatch|jerk)(?:\s+and\s+jerk)?s?\b|\b(?:cargadas?|arrancadas?|enviones?|envi[oó]n)\b/i.test(
    String(raw || ''),
  )
}

export function intervalClockMinutesFromBlock(raw) {
  const text = String(raw || '')
  const stationClockMatch = text.match(
    new RegExp(
      `\\b(\\d+)\\s*estaciones?\\s*(?:de|a)\\s*(${DURATION_TOKEN_SOURCE})`,
      'i',
    ),
  )
  if (stationClockMatch) {
    const stations = Number(stationClockMatch[1])
    const stationSeconds = parseEvoDurationSeconds(stationClockMatch[2])
    if (stations > 0 && stationSeconds > 0) return (stations * stationSeconds) / 60
  }
  const pair = extractEvoWorkRestPairs(text)[0]
  if (!pair) return null
  const roundsMatch =
    text.match(/\b(\d+)\s*(?:rondas?|rounds?|series?|estaciones?)\b/i) ||
    text.match(/\b(\d+)\s*[x×]\s*(?=(?:trabajo|work|on)\b)/i) ||
    text.match(new RegExp(`\\b(\\d+)\\s*[x×]\\s*(?=${DURATION_TOKEN_SOURCE})`, 'i'))
  if (!roundsMatch) return null
  const rounds = Number(roundsMatch[1])
  if (!(rounds > 0)) return null
  const omitsLastRest =
    /\b(?:sin\s+(?:realizar\s+)?(?:el\s+)?[uú]ltimo\s+descanso|no\s+se\s+realiza\s+(?:el\s+)?[uú]ltimo\s+descanso)\b/i.test(
      text,
    )
  const includesLastRest =
    !omitsLastRest &&
    /\b(?:incluye|mant[eé]n|realiza)\s+(?:el\s+)?[uú]ltimo\s+descanso\b/i.test(text)
  const rests = includesLastRest ? rounds : Math.max(0, rounds - 1)
  return (rounds * pair.workSeconds + rests * pair.restSeconds) / 60
}
