import {
  publishedDayProgramText,
  findVideosInProgramText,
  findVideosForPublishedDay,
  findExercisesWithVideos,
  resolveVideoUrlForExerciseLabel,
  shouldOfferAutoVideoForExercise,
} from '../constants/exerciseVideos.js'

function shouldOfferVideoForLibraryRow(row) {
  const name = String(row?.name || '')
  const cat = String(row?.category || '').toLowerCase()
  if (shouldOfferAutoVideoForExercise(name)) return true
  // Si la biblioteca lo clasifica en estas familias, lo tratamos como menos común/técnico.
  return /(movilidad|landmine|core|rotacion|accesor|olimpic|halter|gimnast|skill|tecnic|t[eé]cnica)/i.test(cat)
}

/**
 * Coincidencias por nombre en biblioteca Supabase (todas las filas con nombre).
 * URL: video_url válida si existe; si no, mapa EXERCISE_VIDEOS; si no, búsqueda YouTube.
 */
export function matchLibraryVideosInLowerText(
  lowerText,
  libraryRows,
  { max = 40, dedupeByUrl = true, specializedOnly = false } = {},
) {
  const rows = (libraryRows || []).filter((r) => String(r?.name || '').trim())
  const sorted = [...rows].sort((a, b) => String(b.name || '').length - String(a.name || '').length)
  const out = []
  const usedUrls = new Set()
  const lt = lowerText || ''
  for (const r of sorted) {
    const name = String(r.name || '').trim()
    if (!name) continue
    if (!looksLikeExerciseName(name)) continue
    if (specializedOnly && !shouldOfferVideoForLibraryRow(r)) continue
    if (out.length >= max) break
    if (!lt.includes(name.toLowerCase())) continue
    const url = resolveVideoUrlForExerciseLabel(name, r.video_url, { allowSearchFallback: true })
    if (!url) continue
    if (dedupeByUrl && usedUrls.has(url)) continue
    if (dedupeByUrl) usedUrls.add(url)
    out.push({ name, url })
  }
  return out
}

function mergeLibraryAndStatic(lib, stat) {
  const out = [...lib]
  for (const s of stat || []) {
    const sl = String(s.name || '').toLowerCase()
    const overlapped = lib.some((l) => {
      const ll = String(l.name || '').toLowerCase()
      return ll.includes(sl) || sl.includes(ll)
    })
    if (!overlapped) out.push(s)
  }
  return out
}

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

function filterLikelyExerciseVideos(list) {
  return (list || []).filter((x) => looksLikeExerciseName(x?.name || ''))
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

const NON_EXERCISE_LINE_RE =
  /^([A-C]\)\s*)?(BIENVENIDA|CIERRE|CALENTAMIENTO|TECNICA|TÉCNICA|SKILL(?:S)?|WOD|PARTE|BLOQUE|NOTA|FEEDBACK|CONTEXTO|MATERIAL|CHALLENGE|COMPLETAS?|LADDER|TABATA|RONDAS?)\b/i
const PROGRAMMING_FORMAT_LINE_RE =
  /^(SCORE|TC|TIME CAP|AMRAP|EMOM|E\d+MOM|FOR TIME|EVERY)\b/i
const NON_EXERCISE_CHUNK_RE =
  /\b(each|cada|acumular|acumul(?:a|ar)|desc|descanso|for time|amrap|emom|ladder|challenge|score|time cap|rest|objetivo|contexto|material|hoy|foco|dominar|termin(?:e|ar)|antes|chicos?|chicas?)\b/i

function isLikelyExerciseLine(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (NON_EXERCISE_LINE_RE.test(t)) return false
  if (PROGRAMMING_FORMAT_LINE_RE.test(t)) return false
  if (/(MESOCICLO|SEMANA|ARCHIVO DE CONTEXTO|RESUMEN PARA LA IA)/i.test(t)) return false
  if (/^[A-ZÁÉÍÓÚÑ0-9\s\-–—:()[\]'".+/]{10,}$/.test(t)) return false
  return /[a-zA-Záéíóúñ]/.test(t)
}

function extractFallbackExerciseVideos(text, { max = 18 } = {}) {
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
      const normalizedName = name
        .replace(/\s*[-–—]\s*(suelo|transici[oó]n|progresi[oó]n)\b.*$/i, '')
        .replace(/\b(rm|1rm|2rm|3rm|attempt|intento)\b.*$/i, '')
        .trim()
      if (!normalizedName || normalizedName.length < 4) continue
      if (!MOVEMENT_TOKEN_RE.test(normalizedName)) continue
      const url = resolveVideoUrlForExerciseLabel(normalizedName, null, { allowSearchFallback: true })
      if (!url) continue
      const key = normalizedName.toLowerCase()
      if (used.has(key)) continue
      used.add(key)
      out.push({ name: normalizedName, url })
    }
  }
  return out
}

/** Vídeos del día: prioridad biblioteca Supabase; resto desde mapa estático si no solapan por nombre. */
export function findVideosForPublishedDayResolved(dia, libraryRows) {
  const lib = matchLibraryVideosInLowerText(publishedDayProgramText(dia).toLowerCase(), libraryRows)
  const stat = findVideosForPublishedDay(dia)
  const merged = mergeLibraryAndStatic(lib, stat)
  const fallback = extractFallbackExerciseVideos(publishedDayProgramText(dia), { max: 16 })
  return filterLikelyExerciseVideos(mergeLibraryAndStatic(merged, fallback))
}

/** Vídeos en un fragmento de texto (p. ej. una clase). */
export function findVideosInProgramTextResolved(text, libraryRows, options = {}) {
  const specializedOnly = options.specializedOnly === true
  const lib = matchLibraryVideosInLowerText((text || '').toLowerCase(), libraryRows, { specializedOnly })
  const stat = findVideosInProgramText(text)
  const merged = mergeLibraryAndStatic(lib, stat)
  const fallback = extractFallbackExerciseVideos(text, { max: specializedOnly ? 10 : 18 })
  const withFallback = filterLikelyExerciseVideos(mergeLibraryAndStatic(merged, fallback))
  if (!specializedOnly) return withFallback
  return withFallback.filter((x) => shouldOfferAutoVideoForExercise(x?.name || ''))
}

/** Como findExercisesWithVideos (máx. 8) pero prioriza URLs de la biblioteca Supabase. */
export function findExercisesWithVideosResolved(text, libraryRows) {
  const lib = matchLibraryVideosInLowerText((text || '').toLowerCase(), libraryRows, {
    max: 8,
    dedupeByUrl: true,
  })
  const stat = findExercisesWithVideos(text)
  return mergeLibraryAndStatic(lib, stat).slice(0, 8)
}
