import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

const MAX_SNIP = 8000

function snip(s) {
  const t = String(s ?? '')
  return t.length > MAX_SNIP ? `${t.slice(0, MAX_SNIP)}…` : t
}

/**
 * @param {object|null} prevData
 * @param {object|null} nextData
 * @param {{ actor?: string, source?: string }} meta
 * @returns {null | { at: string, actor: string, source: string, changes: object[] }}
 */
export function buildEditHistoryEntry(prevData, nextData, meta = {}) {
  const actor = meta.actor || 'programador'
  const source = meta.source || 'excel_modal'
  const changes = []

  const diasPrev = prevData?.dias || []
  const diasNext = nextData?.dias || []
  const n = Math.max(diasPrev.length, diasNext.length)

  for (let i = 0; i < n; i++) {
    const dp = diasPrev[i] || {}
    const dn = diasNext[i] || {}
    const dayName = String(dn.nombre || dp.nombre || `Día ${i + 1}`)

    for (const { key, label, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
      const a = String(dp[key] ?? '')
      const b = String(dn[key] ?? '')
      if (a !== b) {
        changes.push({
          day: dayName,
          class: label,
          field: 'sesión',
          before: snip(a),
          after: snip(b),
        })
      }
      const fa = String(dp[feedbackKey] ?? '')
      const fb = String(dn[feedbackKey] ?? '')
      if (fa !== fb) {
        changes.push({
          day: dayName,
          class: label,
          field: 'feedback',
          before: snip(fa),
          after: snip(fb),
        })
      }
    }

    const wa = String(dp.wodbuster ?? '')
    const wb = String(dn.wodbuster ?? '')
    if (wa !== wb) {
      changes.push({
        day: dayName,
        class: 'WodBuster',
        field: 'wodbuster',
        before: snip(wa),
        after: snip(wb),
      })
    }
  }

  const t0 = String(prevData?.titulo ?? '')
  const t1 = String(nextData?.titulo ?? '')
  if (t0 !== t1) {
    changes.push({
      day: '—',
      class: '—',
      field: 'título',
      before: snip(t0),
      after: snip(t1),
    })
  }

  const r0 = prevData?.resumen
  const r1 = nextData?.resumen
  if (JSON.stringify(r0 || {}) !== JSON.stringify(r1 || {})) {
    changes.push({
      day: '—',
      class: '—',
      field: 'resumen',
      before: snip(JSON.stringify(r0 || {}, null, 0)),
      after: snip(JSON.stringify(r1 || {}, null, 0)),
    })
  }

  if (!changes.length) return null

  return {
    at: new Date().toISOString(),
    actor,
    source,
    changes,
  }
}
