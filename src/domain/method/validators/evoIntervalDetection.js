/**
 * Detección estructural de trabajo interválico (no solo la palabra «intervalos»).
 * Reutilizada por validación semanal y generación parcial.
 */

function hasWorkRestRounds(text) {
  return /\b(\d+)\s*rondas?[\s\S]{0,160}?(\d+(?:[.,]\d+)?)\s*['′]?\s*(?:min(?:utos?)?\s*)?(?:de\s*)?trabajo\s*[/|]\s*(\d+(?:[.,]\d+)?)/i.test(
    text,
  )
}

function hasStationRotation(text) {
  return (
    /\bestaci[oó]n(?:es)?\b/i.test(text) &&
    /\b(?:trabajo|min(?:utos?)?|['′]|descanso|rotaci[oó]n|cambio)\b/i.test(text)
  )
}

/** @returns {{ isInterval: boolean, kind?: string, signature?: string }} */
export function detectIntervalStructure(session) {
  const text = String(session || '').trim()
  if (!text || /^\(no programada esta semana\)$/i.test(text) || /^FESTIVO\b/i.test(text)) {
    return { isInterval: false }
  }

  if (/\bINTERVALOS\b/i.test(text)) {
    const signatureMatch = text.match(
      /\b(\d+)\s*rondas?[\s\S]{0,100}?(\d+(?:[.,]\d+)?)\s*['′]?\s*(?:de\s*)?trabajo\s*[/|]\s*(\d+(?:[.,]\d+)?)\s*['′]?\s*(?:de\s*)?descanso/i,
    )
    return {
      isInterval: true,
      kind: 'intervalos_block',
      signature: signatureMatch
        ? `${signatureMatch[2].replace(',', '.')}+${signatureMatch[3].replace(',', '.')}`
        : undefined,
    }
  }

  if (/\bIGYG\b/i.test(text) || /\bI\s*GO\s*YOU\s*GO\b/i.test(text)) {
    return { isInterval: true, kind: 'igyg' }
  }

  if (/\bEMOM\b/i.test(text) || /\bE\d+(?::\d{2})?MOM\b/i.test(text)) {
    return { isInterval: true, kind: 'emom' }
  }

  if (/\bEVERY\s+\d+(?:[.,]\d+)?\s*(?:SEC|SEG|SEGS?|MIN|MINUTOS?)\b/i.test(text)) {
    return { isInterval: true, kind: 'every_cadence' }
  }

  if (
    /\b\d+\s*rondas?\b/i.test(text) &&
    /\b(?:descanso|rest)\s+\d+\s*(?:seg|sec|min)/i.test(text) &&
    /\b(?:for\s+time|por\s+tiempo|wod|amrap|acondicionamiento|aplicaci[oó]n|bloque\s+condicionante|bloque\s+final)\b/i.test(
      text,
    )
  ) {
    return { isInterval: true, kind: 'rounds_with_rest' }
  }

  if (/\bTABATA\b/i.test(text)) {
    return { isInterval: true, kind: 'tabata' }
  }

  if (/\bE\d+(?::\d{2})?MOM\b/i.test(text) && hasWorkRestRounds(text)) {
    return { isInterval: true, kind: 'emom_interval' }
  }

  if (hasWorkRestRounds(text)) {
    const signatureMatch = text.match(
      /(\d+(?:[.,]\d+)?)\s*['′]?\s*(?:min(?:utos?)?\s*)?(?:de\s*)?trabajo\s*[/|]\s*(\d+(?:[.,]\d+)?)/i,
    )
    return {
      isInterval: true,
      kind: 'work_rest_rounds',
      signature: signatureMatch
        ? `${signatureMatch[1].replace(',', '.')}+${signatureMatch[2].replace(',', '.')}`
        : undefined,
    }
  }

  if (hasStationRotation(text)) {
    return { isInterval: true, kind: 'stations' }
  }

  if (/\b(?:cada|every)\s+\d+\s*['′]?\s*(?:x|por)\s*\d+\s*(?:rondas?|series|vueltas)/i.test(text)) {
    return { isInterval: true, kind: 'cadence_rounds' }
  }

  return { isInterval: false }
}
