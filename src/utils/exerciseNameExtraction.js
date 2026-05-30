/**
 * Extracción de nombres de ejercicio a partir del texto de una programación (Excel semanal).
 * Heurística alineada con coachLibraryVideoMatch.js, pero devolviendo NOMBRES limpios para
 * crear filas en la biblioteca (coach_exercise_library), no URLs.
 *
 * También adivina categoría y nivel para prerrellenar; el admin los revisa luego.
 */

const NON_EXERCISE_NAME_RE =
  /\b(cuando|hoy|foco|objetivo|contexto|material|termin(?:a|e|ar)|juntos?|cada|completas?|challenge|score|time cap|for time|amrap|emom|ladder|tabata|cambio|avisa|organiz(?:a|ar)|parejas?|minuto|rol|unidos?|apuntar|wodbuster|attempt|intento|even|felicita(?:r|d|do)?|enhorabuena|bravo)\b/i
const NON_EXERCISE_PREFIX_RE =
  /^(movilidad(?:\s+general|\s+articular)?|calentamiento|briefing|feedback|nota)\b/i
const COACHING_CUE_RE =
  /\b(cambio de|avisa|organiza|organizalos|en parejas|minuto|que se vean|que est[eé]n|todos juntos|descans[ao]|felicita|enhorabuena|bravo)\b/i
const EXERCISE_HINT_RE =
  /\b(squat|lunge|press|row|pull|push|deadlift|snatch|clean|jerk|thruster|burpee|sit[\s-]?up|plank|carry|swing|bridge|raise|ring|muscle[\s-]?up|l[\s-]?sit|pallof|copenhagen|nordic|hip|mobility|stretch|walk|crawl|jump|rope|under|du|d\.u)\b/i
const MOVEMENT_TOKEN_RE =
  /\b(squat|lunge|press|row|pull|push|deadlift|snatch|clean|jerk|thruster|burpee|sit|plank|carry|swing|bridge|raise|ring|muscle|pallof|copenhagen|nordic|hip|stretch|walk|crawl|jump|rope|under|chin|toes|shoulder|wall|handstand|hspu|t2b|c2b|v[\s-]?up|knee|elbow|hang|overhead|dip|support|hold|rotation|rotational|landmine|lm|core)\b/i

const NON_EXERCISE_LINE_RE =
  /^([A-C]\)\s*)?(BIENVENIDA|CIERRE|CALENTAMIENTO|TECNICA|TÉCNICA|SKILL(?:S)?|WOD|PARTE|BLOQUE|NOTA|FEEDBACK|CONTEXTO|MATERIAL|CHALLENGE|COMPLETAS?|LADDER|TABATA|RONDAS?)\b/i
const PROGRAMMING_FORMAT_LINE_RE =
  /^(SCORE|TC|TIME CAP|AMRAP|EMOM|E\d+MOM|FOR TIME|EVERY)\b/i
const NON_EXERCISE_CHUNK_RE =
  /\b(each|cada|acumular|acumul(?:a|ar)|desc|descanso|for time|amrap|emom|ladder|challenge|score|time cap|rest|objetivo|contexto|material|hoy|foco|dominar|termin(?:e|ar)|antes|chicos?|chicas?)\b/i

const LEAD_FILLER_RE =
  /^(que|en|cuando|para|si|hoy|foco|ojo|cada|todos?|tras|al|del?|las?|los|el|y|o|max|maximo|máximo|ultimos?|últimos?|primeros?|segundos?)\b/i
const VERB_PHRASE_RE = /\b(aprend|domin|trabaj|enseñ|ense\u00f1|explica|corrig|recuerd|asegur|busca|intenta|prob[ae])/i

/** Limpia un nombre suelto: quita comillas/tiempos/distancias iniciales y modificadores de coach. */
function polishExerciseName(name) {
  let s = String(name || '').trim()
  s = s.replace(/^[\s'’`"•·\-–—:.,]+/, '')
  // tokens iniciales de distancia/reps/tiempo: "15m", "150m", "10x", "3'", "20 ", "2x"
  s = s.replace(/^(\d+\s*(m|metros|mts|reps?|rep|x|×|min|mins|seg|segs|s|'|″|")?\s*)+/i, '')
  // modificadores de coach al final (merge de variantes; el admin revisa)
  s = s.replace(
    /\s+(liger[oa]|pesad[oa]|controlad[oa]|suave|fuerte|lent[oa]|r[aá]pid[oa]|explosiv[oa]|sincronizad[oa]|synchronized|por\s+equipos?|por\s+parejas?|americano|rus[oa]|cada\s+lado)\b.*$/i,
    '',
  )
  return s.replace(/\s+/g, ' ').trim()
}

function looksLikeExerciseName(name) {
  const s = String(name || '').trim()
  if (!s || s.length < 3) return false
  if (NON_EXERCISE_PREFIX_RE.test(s)) return false
  if (NON_EXERCISE_NAME_RE.test(s)) return false
  if (COACHING_CUE_RE.test(s) && !EXERCISE_HINT_RE.test(s)) return false
  const words = (s.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/g) || []).length
  if (words === 0 || words > 7) return false
  if (/^[\d\s\-–—'"()./+]+$/.test(s)) return false
  if (!MOVEMENT_TOKEN_RE.test(s)) return false
  if (!EXERCISE_HINT_RE.test(s) && words >= 4) return false
  if (/[,:;]$/.test(s)) return false
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(s)
}

function isLikelyExerciseLine(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (NON_EXERCISE_LINE_RE.test(t)) return false
  if (PROGRAMMING_FORMAT_LINE_RE.test(t)) return false
  if (/(MESOCICLO|SEMANA|ARCHIVO DE CONTEXTO|RESUMEN PARA LA IA|RESUMEN DE SEMANA)/i.test(t)) return false
  if (/^[A-ZÁÉÍÓÚÑ0-9\s\-–—:()[\]'".+/]{10,}$/.test(t)) return false
  return /[a-zA-Záéíóúñ]/.test(t)
}

function cleanupExerciseCandidate(line) {
  const raw = String(line || '').trim()
  if (!raw) return ''
  let s = raw
    .replace(/^[•·\-–—]\s*/, '')
    .replace(/^['’`]+\s*/, '')
    .replace(/^\(?[A-Z]\)\s+/, '')
    .replace(/^\d+\s+/, '')
    .replace(/^\d+\s*(x|×)\s*/i, '')
    .replace(/^\d+\s*(reps?|rep|rondas?|rounds?)\s*/i, '')
    .replace(/^\d+\s*(min|sec|s|')\s*/i, '')
    .replace(/^\d+RM\s*/i, '')
    .replace(/\b(score|objetivo|contexto|material|compi|ronda|rondas|rest)\b.*$/i, '')
    .replace(/@\s*.*$/i, '')
    .replace(/\([^)]*\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > 72) s = s.slice(0, 72).trim()
  return s
}

/**
 * Devuelve nombres de ejercicio únicos (con su forma original capitalizada) detectados en texto.
 * @param {string} text
 * @param {{ max?: number }} [opts]
 * @returns {string[]}
 */
export function extractExerciseNamesFromText(text, opts = {}) {
  const max = opts.max ?? 400
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const out = []
  const used = new Set()
  for (const line of lines) {
    if (out.length >= max) break
    if (!isLikelyExerciseLine(line)) continue
    const cleaned = cleanupExerciseCandidate(line)
    if (!cleaned || cleaned.length < 4) continue
    const chunks = cleaned
      .split(/\s*\/\s*|\s+\+\s+|,\s*(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/)
      .map((c) => c.trim())
      .filter(Boolean)
    for (const name of chunks) {
      if (out.length >= max) break
      if (name.length < 4) continue
      const wordCount = (name.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/g) || []).length
      if (wordCount > 7) continue
      if (NON_EXERCISE_CHUNK_RE.test(name)) continue
      if (/[:]/.test(name) && !/\b(l-sit|muscle up|toes to bar|handstand)\b/i.test(name)) continue
      if (/^\d+(\s*[-x×]\s*\d+)+$/.test(name)) continue
      if (/^\d+\s*['"]?\s*(cada|x)\b/i.test(name)) continue
      let normalizedName = name
        .replace(/\s*[-–—]\s*(suelo|transici[oó]n|progresi[oó]n)\b.*$/i, '')
        .replace(/\b(rm|1rm|2rm|3rm|attempt|intento)\b.*$/i, '')
        .trim()
      normalizedName = polishExerciseName(normalizedName)
      if (!normalizedName || normalizedName.length < 4) continue
      if (LEAD_FILLER_RE.test(normalizedName)) continue
      if (VERB_PHRASE_RE.test(normalizedName)) continue
      if (!looksLikeExerciseName(normalizedName)) continue
      const key = normalizeExerciseKey(normalizedName)
      if (used.has(key)) continue
      used.add(key)
      out.push(normalizedName)
    }
  }
  return out
}

/** Normaliza un nombre para comparar/deduplicar (sin acentos, minúsculas, espacios colapsados). */
export function normalizeExerciseKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const CATEGORY_RULES = [
  ['olimpico', /\b(snatch|clean|jerk|arranque|cargada|envi[oó]n|power clean|squat clean|hang)\b/i],
  ['landmine', /\b(landmine|lm\b|press landmine|landmine press|meadows)\b/i],
  ['empuje_vertical', /\b(overhead press|ohp|push press|strict press|military|hspu|handstand|push jerk|press militar|press hombro|z press)\b/i],
  ['empuje_horizontal', /\b(bench|press banca|push[\s-]?up|flexion|flexiones|dip|fondos|floor press|landmine chest)\b/i],
  ['jalon', /\b(pull[\s-]?up|chin[\s-]?up|dominada|row|remo|pull down|jalon|jal[oó]n|muscle[\s-]?up|ring row|toes to bar|t2b|chest to bar|c2b|face pull)\b/i],
  ['bisagra', /\b(deadlift|peso muerto|rdl|hip thrust|hip hinge|good morning|swing|kettlebell swing|kb swing|hinge|nordic|hamstring|glute|puente|bridge)\b/i],
  ['squat', /\b(squat|sentadilla|lunge|zancada|split squat|pistol|step[\s-]?up|wall sit|cossack|goblet)\b/i],
  ['rotacion', /\b(rotation|rotacion|rotaci[oó]n|pallof|russian twist|woodchop|landmine rotation|chop|anti[\s-]?rotation)\b/i],
  ['core', /\b(plank|plancha|hollow|sit[\s-]?up|crunch|dead bug|deadbug|v[\s-]?up|leg raise|knee raise|copenhagen|l[\s-]?sit|toes to bar|abmat)\b/i],
  ['metabolico', /\b(burpee|thruster|wall ball|wallball|box jump|jump rope|double under|du\b|assault|bike|row erg|ski|sprint|carry|farmer|sled|battle rope|mountain climber|jumping)\b/i],
]

/** Adivina categoría (de las usadas por la biblioteca). Default: 'metabolico'. */
export function guessExerciseCategory(name) {
  const s = String(name || '')
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(s)) return cat
  }
  return 'metabolico'
}

const ADVANCED_RE =
  /\b(muscle[\s-]?up|snatch|clean and jerk|squat snatch|squat clean|handstand|hspu|pistol|l[\s-]?sit|ring|nordic|deficit|pause|tempo|single leg|one arm|bulgarian)\b/i
const BASIC_RE =
  /\b(air squat|goblet|plank|plancha|bird dog|dead bug|deadbug|glute bridge|wall|march|step[\s-]?up|farmer|carry|swing|row|push[\s-]?up de rodillas)\b/i

/** Adivina nivel. Default: 'intermedio'. */
export function guessExerciseLevel(name) {
  const s = String(name || '')
  if (ADVANCED_RE.test(s)) return 'avanzado'
  if (BASIC_RE.test(s)) return 'basico'
  return 'intermedio'
}
