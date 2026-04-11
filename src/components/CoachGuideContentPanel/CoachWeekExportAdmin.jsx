import { useState, useEffect } from 'react'
import {
  listPublishedWeeksSummary,
  getPublishedWeekById,
  listCoachSessionFeedbackForWeek,
} from '../../lib/supabase.js'
import { coachAdminUi, coachBorder, coachField, coachText } from '../CoachView/coachTheme.js'
import { buildWeekExportWorkbook, weekExportFileBaseName } from '../../utils/buildWeekExportWorkbook.js'

export default function CoachWeekExportAdmin() {
  const [weeks, setWeeks] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [weekRow, setWeekRow] = useState(null)
  const [feedbackRows, setFeedbackRows] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingList(true)
      setError('')
      try {
        const rows = await listPublishedWeeksSummary(100)
        if (!cancelled) setWeeks(rows)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudieron cargar las semanas')
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setWeekRow(null)
      setFeedbackRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingDetail(true)
      setError('')
      try {
        const row = await getPublishedWeekById(selectedId)
        const fb = await listCoachSessionFeedbackForWeek(selectedId)
        if (!cancelled) {
          setWeekRow(row)
          setFeedbackRows(Array.isArray(fb) ? fb : [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Error cargando la semana')
          setWeekRow(null)
          setFeedbackRows([])
        }
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function handleDownloadExcel() {
    if (!weekRow) return
    setDownloading(true)
    setError('')
    try {
      const { workbook } = await buildWeekExportWorkbook({ weekRow, feedbackRows })
      const buf = await workbook.xlsx.writeBuffer()
      const name = `${weekExportFileBaseName(weekRow)}.xlsx`
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.message || 'Error generando Excel')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`space-y-4 ${coachAdminUi.form}`}>
      <p className={`text-sm ${coachText.muted} leading-relaxed`}>
        Exporta feedback de coaches, historial de cambios guardados en Supabase (<code className="text-[#FFFF4C]/90">edit_history</code>)
        y sugerencias heurísticas para la planificación. Tres hojas: Feedback, Cambios, Recomendaciones.
      </p>

      {error && (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">{error}</p>
      )}

      <div>
        <label className={coachAdminUi.label}>Semana publicada</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loadingList}
          className={coachField}
        >
          <option value="">{loadingList ? 'Cargando…' : 'Selecciona una semana publicada'}</option>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.titulo || 'Sin título'} · {w.mesociclo || '—'} · S{w.semana ?? '—'}
              {w.is_active ? ' · ACTIVA' : ''} ·{' '}
              {w.published_at ? new Date(w.published_at).toLocaleDateString('es-ES') : ''}
            </option>
          ))}
        </select>
      </div>

      {loadingDetail && <p className={`text-sm ${coachText.muted}`}>Cargando detalle…</p>}

      {weekRow && !loadingDetail && (
        <div className={`rounded-xl border ${coachBorder} bg-black/20 px-4 py-3 space-y-2`}>
          <p className={`text-xs font-bold uppercase tracking-widest ${coachText.primary}`}>Vista previa</p>
          <p className={`text-sm ${coachText.muted}`}>
            Feedback: <span className="font-bold text-white">{feedbackRows.length}</span> registro(s). Historial de
            ediciones:{' '}
            <span className="font-bold text-white">{Array.isArray(weekRow.edit_history) ? weekRow.edit_history.length : 0}</span>{' '}
            evento(s).
          </p>
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadExcel}
            className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest"
          >
            {downloading ? 'Generando…' : 'Descargar Excel'}
          </button>
        </div>
      )}
    </div>
  )
}
