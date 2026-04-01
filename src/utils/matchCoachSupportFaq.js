import faqItems from '../data/coachSupportFaq.json'

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * @param {string} questionNormalized texto ya normalizado (sin acentos, minúsculas)
 * @returns {{ id: string, answer: string } | null}
 */
export function matchCoachSupportFaq(questionNormalized) {
  const q = norm(questionNormalized)
  if (!q) return null

  let best = null
  let bestScore = 0

  for (const item of faqItems) {
    let score = 0
    for (const kw of item.keywords || []) {
      const k = norm(kw)
      if (k.length < 2) continue
      if (q.includes(k)) {
        score += k.length >= 5 ? 3 : k.length >= 4 ? 2 : 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }

  if (!best || bestScore < 2) return null
  return { id: best.id, answer: best.answer }
}
