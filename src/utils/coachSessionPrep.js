import { readFeedbackLog } from './coachFeedbackLocalLog.js'
import { DAYS_ES, MESOCYCLES } from '../constants/evoColors.js'

function entryTime(e) {
  const s = e?.created_at || e?.savedAt
  if (!s) return 0
  const t = new Date(s).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Palabras clave de material habituales en programación (español / inglés box).
 * Devuelve etiquetas únicas en orden de aparición aproximado en el texto.
 */
export function extractMaterialHints(text) {
  const raw = String(text || '')
  if (!raw.trim()) return []
  const lower = raw.toLowerCase()
  const found = []
  const seen = new Set()

  const rules = [
    [/kettlebell|\bpesa[s]?\s+rusa\b|\bkb[s]?\b/i, 'Kettlebell / KB'],
    [/mancuerna|dumbbell/i, 'Mancuernas'],
    [/barra(?!\s+ol[ií]mpica)|barbell(?!\s+olympic)/i, 'Barra'],
    [/barra\s+ol[ií]mpica|barbell\s+olympic/i, 'Barra olímpica'],
    [/discos?|bumper|plates?\b/i, 'Discos / bumpers'],
    [/banda[s]?\s+el[aá]stica|resistance\s+band|mini\s+band/i, 'Bandas elásticas'],
    [/\bbox(es)?\b|caj[aó]n/i, 'Cajón / box'],
    [/wall\s*ball|bal[oó]n\s+medicinal|wb\b/i, 'Wall ball'],
    [/ab\s*mat/i, 'AbMat'],
    [/anillas|rings/i, 'Anillas'],
    [/trx|suspensi[oó]n/i, 'TRX / suspensión'],
    [/landmine|land\s*mine/i, 'Landmine'],
    [/remo|rower|concept\s*2/i, 'Remo'],
    [/\bbike\b|bicicleta|assault|echo\s*bike/i, 'Bici / Assault'],
    [/comba|saltos?\s+cuerda|jump\s*rope/i, 'Comba'],
    [/cuerda\s+para\s+tirar|battle\s*rope/i, 'Battle rope'],
    [/sled|trineo|prowler/i, 'Trineo / sled'],
    [/slam\s*ball/i, 'Slam ball'],
    [/foam\s*roller|rodillo/i, 'Rodillo'],
    [/pvc|tubo\s+pvc/i, 'Tubo PVC'],
    [/placas?\s+ponderad|weight\s*vest|chaleco/i, 'Chaleco lastrado'],
    [/pull[\s-]?up|dominadas?/i, 'Barra dominadas'],
    [/paralelas|dip\s*bar|barras\s+paralelas/i, 'Paralelas'],
    [/mancuerna\s+rusa|clubbell|mace/i, 'Mace / club'],
  ]

  for (const [re, label] of rules) {
    if (re.test(lower) && !seen.has(label)) {
      seen.add(label)
      found.push(label)
    }
  }

  return found
}

/**
 * Feedback ya publicado en el JSON semanal (campo `feedback_*` del día).
 * Excluye vacío y el placeholder habitual de «no programada».
 */
export function hasNonTrivialPublishedFeedback(text) {
  const t = String(text || '').trim()
  if (!t) return false
  if (/^\(no programada esta semana\)\s*$/i.test(t)) return false
  return true
}

/**
 * Última entrada del log para esa clase en la semana publicada y en ese día de la semana
 * (p. ej. Preparar clase para Lunes → solo `day_key === 'monday'`).
 * Evita mostrar feedback de otro día (martes) u otra semana.
 */
export function findLastLocalFeedbackSameWeekAndDay(classLabel, currentWeekId, dayKey) {
  if (!classLabel || currentWeekId == null || !dayKey) return null
  const { entries } = readFeedbackLog()
  const wid = String(currentWeekId)
  const same = entries.filter(
    (e) =>
      (e.class_label || '') === classLabel &&
      e.week_id != null &&
      String(e.week_id) === wid &&
      e.day_key === dayKey,
  )
  if (!same.length) return null
  same.sort((a, b) => entryTime(b) - entryTime(a))
  return same[0]
}

/**
 * Última entrada del log local para esa clase (excluyendo la semana actual si hay otra más antigua).
 */
export function findLastFeedbackForClassLabel(classLabel, currentWeekId) {
  if (!classLabel) return null
  const { entries } = readFeedbackLog()
  const sameClass = entries.filter((e) => (e.class_label || '') === classLabel)
  if (!sameClass.length) return null
  sameClass.sort((a, b) => entryTime(b) - entryTime(a))
  const wid = currentWeekId != null ? String(currentWeekId) : null
  if (wid) {
    const older = sameClass.find((e) => e.week_id != null && String(e.week_id) !== wid)
    if (older) return older
  }
  return sameClass[0]
}

/**
 * Última «nota para el siguiente coach» (notes_next_week) para esa clase en el log local.
 * Prioriza otra semana distinta a la actual si existe.
 */
export function findLastCoachHandoffNote(classLabel, currentWeekId) {
  if (!classLabel) return null
  const { entries } = readFeedbackLog()
  const withNote = entries.filter(
    (e) => (e.class_label || '') === classLabel && String(e.notes_next_week || '').trim(),
  )
  if (!withNote.length) return null
  withNote.sort((a, b) => entryTime(b) - entryTime(a))
  const wid = currentWeekId != null ? String(currentWeekId) : null
  if (wid) {
    const older = withNote.find((e) => e.week_id != null && String(e.week_id) !== wid)
    if (older) return formatHandoffNote(older)
  }
  return formatHandoffNote(withNote[0])
}

function formatHandoffNote(e) {
  return {
    note: String(e.notes_next_week || '').trim(),
    coach_name: String(e.coach_name || '').trim() || 'Coach',
    at: e.created_at || e.savedAt || null,
    day_key: e.day_key || null,
  }
}

/** Texto secundario del toast «Nueva semana publicada». */
export function buildCoachNewWeekToastBody(weekData, activeWeekRow) {
  const tit = String(weekData?.titulo || '').trim() || 'Semana activa'
  const dias = weekData?.dias || []
  const first = dias[0]?.nombre
  const last = dias[dias.length - 1]?.nombre
  const range = first && last ? `Del ${first} al ${last}` : ''
  const s = activeWeekRow?.semana
  const m = activeWeekRow?.mesociclo
  const mesoLabel = MESOCYCLES.find((x) => x.value === m)?.label || (m ? String(m) : '')
  const parts = [tit]
  if (s != null && mesoLabel) parts.push(`S${s} ${mesoLabel}`)
  else if (s != null) parts.push(`Semana ${s}`)
  if (range) parts.push(range)
  return parts.join(' · ')
}

export function handoffNoteMetaLine(h) {
  if (!h) return ''
  const when = h.at
    ? (() => {
        try {
          return new Date(h.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
        } catch {
          return ''
        }
      })()
    : ''
  const day = h.day_key ? DAYS_ES[h.day_key] || h.day_key : ''
  const parts = [h.coach_name]
  if (day) parts.push(day)
  if (when) parts.push(when)
  return parts.join(' · ')
}

export function formatFeedbackEntrySummary(entry) {
  if (!entry) return ''
  const parts = []
  const ch = entry.changed_something === true || entry.changed_something === 'true' || entry.changed_something === 1
  if (ch && entry.changed_details?.trim()) parts.push(`Cambios: ${entry.changed_details.trim()}`)
  else if (ch) parts.push('Indicó cambios en sesión (sin detalle en log local).')
  if (entry.group_feelings?.trim()) parts.push(`Grupo: ${entry.group_feelings.trim()}`)
  if (entry.notes_next_week?.trim()) parts.push(`Nota siguiente coach: ${entry.notes_next_week.trim()}`)
  const how = entry.session_how
  if (how) parts.push(`Sesión: ${how}`)
  return parts.join(' · ') || '(Sin notas en esta entrada)'
}
