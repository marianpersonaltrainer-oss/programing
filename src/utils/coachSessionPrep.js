import { readFeedbackLog } from './coachFeedbackLocalLog.js'

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

export function formatFeedbackEntrySummary(entry) {
  if (!entry) return ''
  const parts = []
  const ch = entry.changed_something === true || entry.changed_something === 'true' || entry.changed_something === 1
  if (ch && entry.changed_details?.trim()) parts.push(`Cambios: ${entry.changed_details.trim()}`)
  else if (ch) parts.push('Indicó cambios en sesión (sin detalle en log local).')
  if (entry.group_feelings?.trim()) parts.push(`Grupo: ${entry.group_feelings.trim()}`)
  if (entry.notes_next_week?.trim()) parts.push(`Notas prog.: ${entry.notes_next_week.trim()}`)
  const how = entry.session_how
  if (how) parts.push(`Sesión: ${how}`)
  return parts.join(' · ') || '(Sin notas en esta entrada)'
}
