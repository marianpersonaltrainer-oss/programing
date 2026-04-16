/**
 * Acorta feedback_* de la semana activa para alinearlo con el briefing Marian (SYSTEM_PROMPT_EXCEL):
 * - texto multilínea con foco + org + ⚠️ + (opcional) ⏱ + ✅: recorta por párrafos y techo ~110 palabras
 * - texto corrido antiguo: máximo 4 frases / ~110 palabras
 *
 * Uso:
 *   node --env-file=.env scripts/shorten-active-week-feedback.mjs
 *
 * Requiere permisos UPDATE sobre published_weeks (ideal service role).
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_ANON_KEY).')
  process.exit(1)
}

const supabase = createClient(url, key)

const FEEDBACK_KEYS = [
  'feedback_funcional',
  'feedback_basics',
  'feedback_fit',
  'feedback_hybrix',
  'feedback_fuerza',
  'feedback_gimnastica',
  'feedback_evotodos',
]

const FEEDBACK_WORD_CAP = 110

function compressFeedback(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  if (/^\(no programada esta semana\)\s*$/i.test(text)) return text
  if (/^FESTIVO\b/i.test(text)) return text

  const hasStructuredMarkers = text.includes('⚠️') || text.includes('✅')
  const hasParagraphBreaks = /\n\s*\n/.test(text)

  if (hasStructuredMarkers && hasParagraphBreaks) {
    const paras = text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const wordsAll = paras.join(' ').split(/\s+/).filter(Boolean)
    if (wordsAll.length <= FEEDBACK_WORD_CAP) return paras.join('\n\n')
    const out = []
    let wcount = 0
    for (const p of paras) {
      const pw = p.split(/\s+/).filter(Boolean)
      if (wcount + pw.length <= FEEDBACK_WORD_CAP) {
        out.push(p)
        wcount += pw.length
        continue
      }
      const remaining = FEEDBACK_WORD_CAP - wcount
      if (remaining > 8) out.push(pw.slice(0, remaining).join(' '))
      break
    }
    return out.join('\n\n')
  }

  const norm = text.replace(/\s+/g, ' ').trim()
  const sentenceParts = norm
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const first4 = sentenceParts.slice(0, 4).join(' ')
  const words = first4.split(/\s+/).filter(Boolean)
  if (words.length <= FEEDBACK_WORD_CAP) return first4
  return `${words.slice(0, FEEDBACK_WORD_CAP).join(' ')}.`
}

async function main() {
  const { data: row, error: fetchErr } = await supabase
    .from('published_weeks')
    .select('id, semana, mesociclo, titulo, data, is_active')
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchErr) {
    console.error('Error leyendo semana activa:', fetchErr.message)
    process.exit(1)
  }
  if (!row?.data || !Array.isArray(row.data?.dias)) {
    console.error('No hay semana activa válida con data.dias.')
    process.exit(1)
  }

  if (Number(row.semana) !== 5) {
    console.log(`Semana activa actual = S${row.semana}. No se aplica parche automático (esperaba S5).`)
    process.exit(0)
  }

  const nextData = structuredClone(row.data)
  let changed = 0
  for (const dia of nextData.dias) {
    for (const k of FEEDBACK_KEYS) {
      const prev = String(dia?.[k] || '')
      if (!prev.trim()) continue
      const next = compressFeedback(prev)
      if (next !== prev) {
        dia[k] = next
        changed += 1
      }
    }
  }

  if (!changed) {
    console.log('No hubo cambios: feedback ya estaba corto en la semana activa.')
    process.exit(0)
  }

  const { error: upErr } = await supabase
    .from('published_weeks')
    .update({
      data: nextData,
      titulo: nextData.titulo || row.titulo,
    })
    .eq('id', row.id)

  if (upErr) {
    console.error('No se pudo actualizar published_weeks (RLS/permisos):', upErr.message)
    process.exit(1)
  }

  console.log(`OK: semana activa S${row.semana} actualizada. Feedbacks acortados: ${changed}. id=${row.id}`)
}

main()

