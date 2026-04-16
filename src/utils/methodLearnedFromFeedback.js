import { DAYS_ES } from '../constants/evoColors.js'

const HOW_LABEL = {
  muy_bien: 'Muy bien',
  bien: 'Bien',
  regular: 'Regular',
  mal: 'Mal',
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function feedbackRowIsConvertible(row) {
  if (!row || typeof row !== 'object') return false
  const hasNote = Boolean(cleanText(row.notes_next_week))
  const isLowRating = row.session_how === 'regular' || row.session_how === 'mal'
  return hasNote || isLowRating
}

export function buildLearnedDraftFromFeedback(row) {
  const day = cleanText(DAYS_ES[row?.day_key] || row?.day_key) || 'Día'
  const cls = cleanText(row?.class_label) || 'Clase'
  const note = cleanText(row?.notes_next_week)
  const how = cleanText(HOW_LABEL[row?.session_how] || row?.session_how)
  const week = row?.semana != null ? `S${row.semana}` : ''
  const meso = row?.mesociclo != null ? String(row.mesociclo) : ''
  const coach = cleanText(row?.coach_name)

  if (note) {
    const suffix = [coach, meso && week ? `${meso} ${week}` : week || meso].filter(Boolean).join(' · ')
    return suffix
      ? `${day} ${cls} — Nota coach: ${note} (${suffix})`
      : `${day} ${cls} — Nota coach: ${note}`
  }

  if (row?.session_how === 'regular' || row?.session_how === 'mal') {
    const label = how || 'Regular/Mal'
    return `${day} ${cls} — Sesión valorada como ${label}; revisar diseño y ajustes para próxima semana`
  }

  return `${day} ${cls} — Revisar feedback de sesión`
}
