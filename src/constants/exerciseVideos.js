// Biblioteca de vídeos de ejercicios EVO
// Cada entrada enlaza a un vídeo concreto (watch?v=ID) para unificar el método.
// Añade o edita ejercicios aquí según necesites.

const V = (id) => `https://www.youtube.com/watch?v=${id}`

export const EXERCISE_VIDEOS = {

  // ── CALENTAMIENTO & MOVILIDAD ─────────────────────────────────────────────
  'cat camel':              V('MfhNDwYS6PA'),
  'cat cow':                V('MfhNDwYS6PA'),
  'world greatest stretch': V('jT_hTeD0AjQ'),
  'worlds greatest stretch':V('jT_hTeD0AjQ'),
  'inchworm':               V('TvxjBjTkjZk'),
  'cossack squat':          V('nauWr8jLEv8'),
  'hip 90/90':              V('h_yZV27H684'),
  '90/90':                  V('h_yZV27H684'),
  'scap push up':           V('slP2_HnBfRM'),
  'scap pushup':            V('slP2_HnBfRM'),
  'wall slide':             V('6LKsrv0Zb5w'),
  'band pull apart':        V('0nijQXv9V8I'),
  'bear crawl':             V('CUseb0Zycm0'),
  'hip circle':             V('mPIOP62ZS9Y'),
  'ankle mobility':         V('K9XqeF-p0ng'),
  'jefferson curl':         V('Z1516UaY5wU'),
  'thoracic rotation':      V('2bRNXtnfq6I'),
  'dead bug':               V('g_BYB0RkYZI'),
  'hollow body hold':       V('Nl-j64tBXSA'),
  'hollow rock':            V('XKAGZk8WXfQ'),
  'hip transition':         V('tQOVGcfNxmo'),
  '90/90 hip transition':   V('h_yZV27H684'),
  'bottom squat hold':      V('pSZJ2WnIFfM'),
  'lateral lunge':          V('5ZT-GeYND9g'),
  'reverse lunge':          V('xCrdYITmxv4'),
  'calf raise':             V('GWOPeEknHkY'),
  'arm circle':             V('T4sfYPUkyqo'),

  // ── LANDMINE ─────────────────────────────────────────────────────────────
  'landmine clean':         V('xa1EgqthXrw'),
  'landmine thruster':      V('BUZtVXsxApY'),
  'landmine rotational press': V('i953czRec9Q'),
  'landmine press':         V('QbY5mXdnp0k'),
  'landmine rdl':           V('P10Iw43wkww'),
  'landmine goblet squat':  V('0X_JsdGzFwk'),
  'landmine squat':         V('OiYhXnGncY8'),
  'landmine meadows row':   V('koP10Ey6bAs'),
  'meadows row':            V('koP10Ey6bAs'),
  'landmine hip thrust':    V('s9YBB9gTgLw'),
  'landmine antirotation press': V('iZKkCvNTV6Y'),
  'landmine single leg rdl':V('e_IiDLZ2AkY'),

  // ── ACCESORIOS & CORE ────────────────────────────────────────────────────
  'copenhagen plank':       V('BEXLOLvRvXE'),
  'nordic curl':            V('vCD2szDGIPs'),
  'pallof press':           V('iZKkCvNTV6Y'),
  'single leg rdl':         V('e_IiDLZ2AkY'),
  'spanish squat':          V('4fTkPv77HwQ'),
  'banded face pull':       V('qX84AvMxW_c'),
  'face pull':              V('qX84AvMxW_c'),
  'banded lateral walk':    V('XwJwEX7lVpE'),
  'lateral walk':           V('XwJwEX7lVpE'),
  'hip thrust':             V('Xm7y-YGAZkA'),
  'glute bridge':           V('DF2VobieRnI'),
  'lateral raise':          V('3VcKaXpzqRo'),
  'rear delt fly':          V('joVZdT3tiZM'),
  'rear delt':              V('joVZdT3tiZM'),
  'tricep pushdown':        V('2-LAMcpzODU'),
  'triceps pushdown':       V('2-LAMcpzODU'),
  'skull crusher':          V('d_KZxkY_0cM'),
  'barbell curl':           V('LY1V6UbRHFM'),
  'hammer curl':            V('zC3nLlEvin4'),
  'reverse fly':            V('joVZdT3tiZM'),
  'romanian deadlift':      V('jEyCgRyN5UQ'),
  'sumo deadlift':          V('wQHSYDSgTc4'),
  'jefferson deadlift':     V('zfHMycFFOyg'),
  'deficit deadlift':       V('wkeGB5_mL2w'),
  'deadlift':               V('op9kVJYsXeo'),
  'back squat':             V('ultWZbUMPL8'),
  'front squat':            V('mRXjZKHvzLY'),
  'bench press':            V('4Y2ZdHCO1ok'),
  'push up':                V('_l3yHaKYrQY'),
  'push-up':                V('_l3yHaKYrQY'),
  'pull up':                V('eGo4IYlbE5g'),
  'pull-up':                V('eGo4IYlbE5g'),
  'bulgarian split squat':  V('2C-uNgKwPLE'),

  // ── KETTLEBELL ───────────────────────────────────────────────────────────
  'kb snatch':              V('vJHoKX0oYLM'),
  'kb clean':               V('btxCG6k-lRM'),
  'kb swing americano':     V('ysXN5uKQAd0'),
  'kb swing ruso':          V('ISOKgl24gRc'),
  'kb turkish get up':      V('jFK8FOiLa_M'),
  'turkish get up':         V('jFK8FOiLa_M'),
  'kb windmill':            V('y573OamwuYU'),
  'kb goblet squat':        V('j81EPr-hXxc'),
  'goblet squat':           V('MeIiIdhvXT4'),
  'suitcase carry':         V('CJngWxJKWUA'),
  'waiter walk':            V('qNMDuZQQzG0'),
  'farmer carry':           V('MfMkm_Nd4R8'),

  // ── FUNCIONALES / GIMNÁSTICOS ─────────────────────────────────────────────
  'ring row':               V('1FmXzMJs0yo'),
  'ring dip':               V('eMphE7sBD6Y'),
  't2b':                    V('Q89vtx5TptE'),
  'toes to bar':            V('Q89vtx5TptE'),
  'hanging knee raise':     V('PJqF1IWFO8o'),
  'ghd sit up':             V('6FZHJGzMGHc'),
  'box jump':               V('CT7lDHejU64'),
  'burpee box jump':        V('qhJTa_SC3wc'),
  'step up':                V('sxwzDEWs_IA'),
  'box step up':            V('sxwzDEWs_IA'),
  'hspu':                   V('ck3Y2ZisE1g'),
  'handstand push up':      V('ck3Y2ZisE1g'),
  'kipping pull up':        V('lzRo-4pq_AY'),
  'chest to bar':           V('WefN0FWQ1qA'),
  'c2b':                    V('pCvSlkby03Q'),

  // ── OLÍMPICOS ─────────────────────────────────────────────────────────────
  'power clean':            V('EKRiW9Yt3Ps'),
  'hang power clean':       V('nvsEjHtjbGQ'),
  'hang clean':             V('8sTXxyK501Q'),
  'power snatch':           V('9xQp2sldyts'),
  'hang power snatch':      V('TTfhUjhdMOc'),
  'hang snatch':            V('yR9wKLNn7eM'),
  'push jerk':              V('V-hKuAfWNUw'),
  'split jerk':             V('nWyx81Kl9Lw'),
  'push press':             V('iaBVSJm78ko'),
  'thruster':               V('aea5BGj9a8Y'),
  'db thruster':            V('S-IJ5e4NlMQ'),
  'db snatch':              V('DNUkXOLCc90'),
  'db hang snatch':         V('pSH8JPWwx64'),
  'db clean':               V('G7_JJepCEgU'),
}

/** Lista ordenada de claves del mapa estático (referencia para el coach). */
export const EXERCISE_VIDEO_STATIC_KEYS_SORTED = Object.keys(EXERCISE_VIDEOS).sort((a, b) =>
  a.localeCompare(b, 'es'),
)

// Categorías para la Biblioteca
export const EXERCISE_CATEGORIES = {
  calentamiento: ['cat camel', 'cat cow', 'world greatest stretch', 'inchworm', 'cossack squat', 'hip 90/90', 'scap push up', 'wall slide', 'band pull apart', 'bear crawl', 'dead bug', 'hollow body hold', 'hollow rock', 'hip transition', 'bottom squat hold', 'lateral lunge'],
  landmine: ['landmine clean', 'landmine thruster', 'landmine rotational press', 'landmine press', 'landmine rdl', 'landmine goblet squat', 'landmine squat', 'landmine meadows row', 'meadows row', 'landmine hip thrust', 'landmine antirotation press'],
  accesorios: ['copenhagen plank', 'nordic curl', 'pallof press', 'single leg rdl', 'spanish squat', 'face pull', 'banded face pull', 'banded lateral walk', 'hip thrust', 'glute bridge', 'lateral raise', 'rear delt fly', 'skull crusher', 'barbell curl', 'hammer curl'],
  kettlebell: ['kb snatch', 'kb clean', 'kb swing americano', 'kb swing ruso', 'turkish get up', 'kb windmill', 'goblet squat', 'suitcase carry', 'waiter walk', 'farmer carry'],
  olimpicos: ['power clean', 'hang power clean', 'hang clean', 'power snatch', 'hang power snatch', 'push jerk', 'push press', 'thruster', 'db thruster', 'db snatch', 'db clean'],
}

/** Claves de sesión en JSON publicado (coach / Excel). */
export const PUBLISHED_DAY_BLOCK_KEYS = [
  'evofuncional',
  'evobasics',
  'evofit',
  'evohybrix',
  'evofuerza',
  'evogimnastica',
  'evotodos',
]

function normalizeExerciseMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\blm\b/g, 'landmine')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const BROKEN_YOUTUBE_IDS = new Set([
  // Detectado en producción: YouTube devuelve "Este vídeo ya no está disponible".
  '5ZT-GeYND9g',
])

const SPECIALIZED_VIDEO_HINT_RE =
  /\b(landmine|lm|mobility|movilidad|stretch|scap|copenhagen|pallof|jefferson|nordic|meadows|windmill|turkish|get\s*up|dead\s*bug|hollow|thoracic|ankle|hip\s*transition|face\s*pull|carry|antirotation|accesor|t[eé]cnica|activation|activaci[oó]n)\b/i

const TOO_GENERIC_MOVEMENT_RE =
  /\b(squat|deadlift|press|clean|snatch|jerk|thruster|pull[\s-]?up|push[\s-]?up|burpee|box\s*jump|lunge|run|rowing|rower|bike|wall\s*ball|toes?\s*to\s*bar|t2b|c2b)\b/i

function extractYoutubeId(url) {
  const s = String(url || '')
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : ''
}

function sanitizeVideoUrl(rawUrl) {
  const u = String(rawUrl || '').trim()
  if (!u || !/^https?:\/\//i.test(u)) return null
  const id = extractYoutubeId(u)
  if (id && BROKEN_YOUTUBE_IDS.has(id)) return null
  return u
}

/** Solo autolink para ejercicios poco obvios/técnicos; evita enlazar todo a búsquedas genéricas. */
export function shouldOfferAutoVideoForExercise(label) {
  const n = normalizeExerciseMatch(label)
  if (!n) return false
  if (SPECIALIZED_VIDEO_HINT_RE.test(n)) return true
  if (TOO_GENERIC_MOVEMENT_RE.test(n)) return false
  return n.length >= 12
}

/** Mejor coincidencia por subcadena (clave más larga gana); prueba también trozos del nombre (A + B). */
export function findStaticVideoUrlForExerciseLabel(label) {
  const lower = normalizeExerciseMatch(label)
  const sorted = Object.entries(EXERCISE_VIDEOS).sort((a, b) => b[0].length - a[0].length)
  const normKeys = sorted.map(([key, url]) => [normalizeExerciseMatch(key), url])

  function bestIn(text) {
    let bestUrl = null
    let bestLen = 0
    for (const [nk, url] of normKeys) {
      if (!nk || !text.includes(nk)) continue
      if (nk.length > bestLen) {
        bestLen = nk.length
        bestUrl = url
      }
    }
    return bestUrl
  }

  const direct = bestIn(lower)
  if (direct) return sanitizeVideoUrl(direct)

  const segments = lower
    .split(/[,;/|·]|\s+\+\s+|\s+y\s+|\s+vs\s+|\s+[/]\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const seg of segments) {
    const hit = bestIn(seg)
    if (hit) return sanitizeVideoUrl(hit)
  }
  return null
}

/** Búsqueda más específica (último recurso) para ejercicios técnicos/no obvios. */
export function buildVideoSearchFallbackUrl(label) {
  const base = String(label || '')
    .trim()
    .replace(/\bLM\b/gi, 'landmine')
  const q = encodeURIComponent(`${base} exercise tutorial technique`)
  return `https://www.youtube.com/results?search_query=${q}`
}

/**
 * Supabase tiene prioridad si hay URL http(s); si no, mapa estático; si no, búsqueda YouTube.
 */
export function resolveVideoUrlForExerciseLabel(displayName, supabaseUrl, options = {}) {
  const allowSearchFallback = options.allowSearchFallback !== false
  const raw = sanitizeVideoUrl(supabaseUrl)
  if (raw) return raw
  const staticUrl = findStaticVideoUrlForExerciseLabel(displayName)
  if (staticUrl) return staticUrl
  if (!allowSearchFallback) return null
  if (!shouldOfferAutoVideoForExercise(displayName)) return null
  return buildVideoSearchFallbackUrl(displayName)
}

export function publishedDayProgramText(dia) {
  if (!dia) return ''
  const parts = []
  for (const k of PUBLISHED_DAY_BLOCK_KEYS) {
    if (dia[k]) parts.push(String(dia[k]))
  }
  if (dia.wodbuster) parts.push(String(dia.wodbuster))
  return parts.join('\n')
}

function matchVideosInLowerText(normalizedText, { max = 40, dedupeByUrl = true } = {}) {
  if (!normalizedText) return []
  const sorted = Object.entries(EXERCISE_VIDEOS).sort((a, b) => b[0].length - a[0].length)
  const out = []
  const usedUrls = new Set()
  for (const [name, url] of sorted) {
    if (out.length >= max) break
    if (!normalizedText.includes(normalizeExerciseMatch(name))) continue
    if (dedupeByUrl && usedUrls.has(url)) continue
    if (dedupeByUrl) usedUrls.add(url)
    out.push({ name, url })
  }
  return out
}

/** Texto libre (p. ej. una sola sesión). */
export function findVideosInProgramText(text, options = {}) {
  return matchVideosInLowerText(normalizeExerciseMatch(text), {
    max: options.max ?? 40,
    dedupeByUrl: options.dedupeByUrl !== false,
  })
}

/** Un día publicado: detecta ejercicios de la biblioteca en toda la programación del día. */
export function findVideosForPublishedDay(dia, options = {}) {
  return findVideosInProgramText(publishedDayProgramText(dia), options)
}

// Busca ejercicios en un texto (Excel / compat). Máx. 8 sugerencias.
export function findExercisesWithVideos(text) {
  return matchVideosInLowerText(normalizeExerciseMatch(text), { max: 8, dedupeByUrl: true })
}
