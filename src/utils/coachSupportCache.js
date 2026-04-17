/** Caché local de respuestas del chat Soporte (misma semana + día + clase + pregunta). v2 = prompt soporte Sprint 3. */

export function supportSlug(value) {
  const s = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40)
  return s || 'general'
}

function hashQuestion(s) {
  const str = String(s || '')
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

export function buildSupportCacheKey(weekId, daySlug, classSlug, questionNormalized) {
  const w = String(weekId || 'no-week')
  const d = String(daySlug || 'general').slice(0, 48)
  const c = String(classSlug || 'general').slice(0, 48)
  const h = hashQuestion(questionNormalized)
  return `coach_support_v2_${w}_${d}_${c}_${h}`
}

export function getSupportCachedReply(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o.text !== 'string' || !o.text.trim()) return null
    return o.text
  } catch {
    return null
  }
}

export function setSupportCachedReply(storageKey, text) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ v: 1, text, ts: Date.now() }))
  } catch {
    /* quota o modo privado */
  }
}
