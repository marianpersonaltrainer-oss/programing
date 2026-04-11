import ExcelJS from 'exceljs'
import { DAYS_ES } from '../constants/evoColors.js'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

const HOW_LABELS = {
  muy_bien: 'Muy bien',
  bien: 'Bien',
  regular: 'Regular',
  mal: 'Mal',
}

function dayLabel(key) {
  return DAYS_ES[key] || key || '—'
}

function classFromRow(row) {
  return row?.class_label || '—'
}

/**
 * @param {object} opts
 * @param {object} opts.weekRow — fila published_weeks (id, titulo, semana, mesociclo, data, edit_history, published_at)
 * @param {object[]} opts.feedbackRows — coach_session_feedback para week_id
 */
export async function buildWeekExportWorkbook({ weekRow, feedbackRows = [] }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ProgramingEvo'

  // ── Hoja 1: Feedback ─────────────────────────────────
  const shF = wb.addWorksheet('Feedback', {
    properties: { defaultRowHeight: 18 },
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  shF.columns = [
    { header: 'Día', key: 'day', width: 14 },
    { header: 'Clase', key: 'class', width: 18 },
    { header: 'Coach', key: 'coach', width: 16 },
    { header: 'Sesión (cómo fue)', key: 'how', width: 14 },
    { header: 'Tiempo explicación', key: 'time', width: 16 },
    { header: 'Cambió algo', key: 'changed', width: 12 },
    { header: 'Detalle cambios', key: 'changedDet', width: 36 },
    { header: 'Sensaciones grupo', key: 'group', width: 36 },
    { header: 'Nota siguiente coach', key: 'next', width: 40 },
    { header: 'Fecha', key: 'at', width: 20 },
  ]
  shF.getRow(1).font = { bold: true }

  const counts = { muy_bien: 0, bien: 0, regular: 0, mal: 0, otro: 0 }
  for (const r of feedbackRows) {
    const how = r.session_how
    if (how && counts[how] !== undefined) counts[how] += 1
    else if (how) counts.otro += 1
    shF.addRow({
      day: dayLabel(r.day_key),
      class: classFromRow(r),
      coach: r.coach_name || '—',
      how: HOW_LABELS[how] || how || '—',
      time: r.time_for_explanation || '—',
      changed: r.changed_something ? 'Sí' : 'No',
      changedDet: r.changed_details || '',
      group: r.group_feelings || '',
      next: r.notes_next_week || '',
      at: r.created_at ? new Date(r.created_at).toLocaleString('es-ES') : '—',
    })
  }

  if (feedbackRows.length === 0) {
    shF.addRow({
      day: '(sin registros)',
      class: '—',
      coach: '—',
      how: '—',
      time: '—',
      changed: '—',
      changedDet: '',
      group: '',
      next: '',
      at: '—',
    })
  }

  shF.addRow({})
  const rSum = shF.addRow({
    day: 'RESUMEN sesión (conteo)',
    class: `Muy bien: ${counts.muy_bien}`,
    coach: `Bien: ${counts.bien}`,
    how: `Regular: ${counts.regular}`,
    time: `Mal: ${counts.mal}`,
    changed: '',
    changedDet: '',
    group: '',
    next: '',
    at: '',
  })
  rSum.font = { bold: true }

  // ── Hoja 2: Cambios ─────────────────────────────────
  const shC = wb.addWorksheet('Cambios', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  shC.columns = [
    { header: 'Fecha', key: 'at', width: 22 },
    { header: 'Quién', key: 'actor', width: 16 },
    { header: 'Origen', key: 'source', width: 14 },
    { header: 'Día', key: 'day', width: 14 },
    { header: 'Clase / ámbito', key: 'class', width: 18 },
    { header: 'Campo', key: 'field', width: 12 },
    { header: 'Antes (resumen)', key: 'before', width: 45 },
    { header: 'Después (resumen)', key: 'after', width: 45 },
  ]
  shC.getRow(1).font = { bold: true }

  const history = Array.isArray(weekRow?.edit_history) ? weekRow.edit_history : []
  for (const entry of history) {
    const at = entry.at ? new Date(entry.at).toLocaleString('es-ES') : '—'
    const actor = entry.actor || '—'
    const source = entry.source || '—'
    const chs = Array.isArray(entry.changes) ? entry.changes : []
    if (!chs.length) {
      shC.addRow({ at, actor, source, day: '—', class: '—', field: '—', before: '', after: '(sin detalle)' })
      continue
    }
    for (const c of chs) {
      shC.addRow({
        at,
        actor,
        source,
        day: c.day || '—',
        class: c.class || '—',
        field: c.field || '—',
        before: String(c.before || '').slice(0, 5000),
        after: String(c.after || '').slice(0, 5000),
      })
    }
  }
  if (!history.length) {
    shC.addRow({
      at: '—',
      actor: '—',
      source: '—',
      day: '—',
      class: '—',
      field: '—',
      before: '',
      after: 'No hay registros en edit_history (los cambios se irán acumulando al guardar desde Generar programación).',
    })
  }

  // ── Hoja 3: Recomendaciones (heurística) ────────────
  const shR = wb.addWorksheet('Recomendaciones', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  shR.columns = [{ header: 'Tema', key: 't', width: 28 }, { header: 'Sugerencia', key: 's', width: 80 }]
  shR.getRow(1).font = { bold: true }

  const lines = buildRecommendationLines({ counts, feedbackRows, weekRow })
  for (const { t, s } of lines) {
    shR.addRow({ t, s })
  }

  return { workbook: wb }
}

function buildRecommendationLines({ counts, feedbackRows, weekRow }) {
  const out = []
  const n = feedbackRows.length
  const totalHow = counts.muy_bien + counts.bien + counts.regular + counts.mal
  out.push({
    t: 'Contexto',
    s: `Semana: ${weekRow?.titulo || '—'} · ${weekRow?.mesociclo || '—'} · S${weekRow?.semana ?? '—'} · ${n} registro(s) de feedback en exportación.`,
  })

  if (totalHow > 0) {
    const pct = (x) => Math.round((x / totalHow) * 100)
    out.push({
      t: 'Distribución sensación sesión',
      s: `Muy bien ${counts.muy_bien} (${pct(counts.muy_bien)}%) · Bien ${counts.bien} (${pct(counts.bien)}%) · Regular ${counts.regular} (${pct(counts.regular)}%) · Mal ${counts.mal} (${pct(counts.mal)}%).`,
    })
  }

  if (counts.mal >= 2 || (totalHow >= 3 && counts.mal / totalHow >= 0.25)) {
    out.push({
      t: 'Intensidad / volumen',
      s: 'Varias sesiones valoradas como «Mal»: revisar carga, tiempo de WOD o complejidad técnica la próxima semana.',
    })
  }

  if (counts.regular >= 3 && counts.mal < 2) {
    out.push({
      t: 'Ajuste fino',
      s: 'Varias «Regular»: valorar microajustes de timing, descansos o progresión en lugar de cambiar el estímulo global.',
    })
  }

  const notes = feedbackRows
    .map((r) => String(r.notes_next_week || '').trim())
    .filter(Boolean)
  if (notes.length) {
    const joined = notes.slice(0, 12).join(' · ')
    out.push({
      t: 'Notas de coaches (patrones)',
      s: `Texto recogido de «nota siguiente coach»: ${joined}${notes.length > 12 ? ' …' : ''}`,
    })
  }

  const changed = feedbackRows.filter((r) => r.changed_something).length
  if (changed >= 2) {
    out.push({
      t: 'Adaptaciones en sala',
      s: `${changed} sesiones con cambios sobre lo programado: revisar si el problema es timing, equipamiento o exceso de ambición en el papel.`,
    })
  }

  const dias = weekRow?.data?.dias || []
  const classLoad = {}
  for (const d of dias) {
    for (const { key, label } of EVO_SESSION_CLASS_DEFS) {
      const t = String(d[key] || '').trim()
      if (t && !/^\(no programada/i.test(t)) {
        classLoad[label] = (classLoad[label] || 0) + 1
      }
    }
  }
  const busy = Object.entries(classLoad)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} (${v} días con texto)`)
    .join(', ')
  if (busy) {
    out.push({
      t: 'Carga por clase (programado)',
      s: `Clases con más sesiones escritas esta semana: ${busy}. Útil para equilibrar la próxima semana.`,
    })
  }

  if (out.length === 1) {
    out.push({
      t: 'General',
      s: 'Poco feedback numérico todavía: anima a los coaches a completar el formulario tras clase para enriquecer el análisis.',
    })
  }

  return out
}

/**
 * Nombre archivo: Feedback_Semana_S4_6abril_2026.xlsx
 */
export function weekExportFileBaseName(weekRow) {
  const s = weekRow?.semana != null ? `S${weekRow.semana}` : 'S'
  const d = weekRow?.published_at ? new Date(weekRow.published_at) : new Date()
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]
  const day = d.getDate()
  const month = months[d.getMonth()] || 'mes'
  const year = d.getFullYear()
  return `Feedback_Semana_${s}_${day}${month}_${year}`.replace(/\s+/g, '')
}
