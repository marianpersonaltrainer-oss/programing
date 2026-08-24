import { useEffect, useMemo, useRef, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import {
  buildEvoAiContextPrompt,
  EVO_AI_CONTEXT_FIELDS,
  getWeekEvoAiContext,
  mergeWeekEvoAiContext,
} from '../../domain/programming/evoAiContext.js'
import { projectLegacyWeekForStructuredImport } from '../../domain/programming/legacyWeekImportProjection.js'
import Pe2ExcelImportReview from './Pe2ExcelImportReview.jsx'
import Pe2WeeklyDraftBoard from './Pe2WeeklyDraftBoard.jsx'
import Pe2WeeklyTeamReview from './Pe2WeeklyTeamReview.jsx'
import { updatePe2Week } from '../../lib/pe2Supabase.js'
import { importProgramingEvoWeekFromXlsxBuffer } from '../../utils/importProgramingEvoWeekXlsx.js'

const LEGACY_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function emptyLegacyWeek() {
  return { dias: LEGACY_DAYS.map((nombre) => ({ nombre })) }
}

export default function Pe2AiPlanningPanel({ week, onSaved }) {
  const [context, setContext] = useState(() => getWeekEvoAiContext(week))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [weeklyPlan, setWeeklyPlan] = useState(() => week?.data?.weekly_plan || null)
  const [teamReviewPrepared, setTeamReviewPrepared] = useState(() => Boolean(week?.data?.team_review_prepared))
  const fileInputRef = useRef(null)
  const preview = useMemo(() => buildEvoAiContextPrompt(context), [context])

  useEffect(() => {
    setContext(getWeekEvoAiContext(week))
    setMessage('')
    setImportPreview(null)
    setWeeklyPlan(week?.data?.weekly_plan || null)
    setTeamReviewPrepared(Boolean(week?.data?.team_review_prepared))
  }, [week?.id])

  const update = (key, value) => setContext((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (!week?.id) return
    setSaving(true)
    setMessage('')
    try {
      const saved = await updatePe2Week(week.id, {
        data: mergeWeekEvoAiContext(week, context),
      })
      onSaved?.(saved)
      setMessage('Contexto guardado para toda la semana.')
    } catch (error) {
      setMessage(error.message || 'No se pudo guardar el contexto.')
    } finally {
      setSaving(false)
    }
  }

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(preview)
      setMessage('Vista previa copiada.')
    } catch {
      setMessage('No se pudo copiar automáticamente. Puedes seleccionar el texto de abajo.')
    }
  }

  const saveWeeklyPlan = async () => {
    if (!week?.id || !weeklyPlan) return
    setSaving(true)
    setMessage('')
    try {
      const saved = await updatePe2Week(week.id, {
        data: {
          ...mergeWeekEvoAiContext(week, context),
          weekly_plan: weeklyPlan,
          team_review_prepared: false,
        },
      })
      onSaved?.(saved)
      setWeeklyPlan(saved.data?.weekly_plan || weeklyPlan)
      setTeamReviewPrepared(false)
      setMessage('Borrador semanal guardado. Ahora puedes preparar su revisión para el equipo; no se publica automáticamente.')
    } catch (error) {
      setMessage(error.message || 'No se pudo guardar el borrador semanal.')
    } finally {
      setSaving(false)
    }
  }

  const setReviewPrepared = async (prepared) => {
    if (!week?.id || !weeklyPlan) return
    setSaving(true)
    setMessage('')
    try {
      const saved = await updatePe2Week(week.id, {
        data: {
          ...mergeWeekEvoAiContext(week, context),
          weekly_plan: weeklyPlan,
          team_review_prepared: prepared,
          team_review_prepared_at: prepared ? new Date().toISOString() : null,
        },
      })
      onSaved?.(saved)
      setWeeklyPlan(saved.data?.weekly_plan || weeklyPlan)
      setTeamReviewPrepared(prepared)
      setMessage(
        prepared
          ? 'Revisión del equipo preparada. Sigue privada: todavía no se ha enviado ni publicado nada.'
          : 'La semana ha vuelto a edición privada.',
      )
    } catch (error) {
      setMessage(error.message || 'No se pudo actualizar la revisión del equipo.')
    } finally {
      setSaving(false)
    }
  }

  const prepareWeeklyPlan = () => {
    if (!importPreview) return
    setWeeklyPlan({
      version: 1,
      sourceFile: importPreview.fileName || '',
      sessions: importPreview.sessions.map((session) => ({
        sourceId: session.sourceId,
        weekday: session.weekday,
        dayName: session.dayName,
        classTypeKey: session.classTypeKey,
        classType: session.classType,
        title: session.title,
        programming: session.programming,
        feedback: session.feedback,
      })),
    })
    setMessage('La semana está preparada como borrador editable. Revísala y guárdala cuando quieras.')
  }

  const reviewExcel = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImporting(true)
    setMessage('')
    try {
      const result = await importProgramingEvoWeekFromXlsxBuffer(await file.arrayBuffer(), emptyLegacyWeek())
      const nextPreview = projectLegacyWeekForStructuredImport(result.data)
      setImportPreview({ fileName: file.name, warnings: result.warnings || [], ...nextPreview })
      setMessage('Excel leído solo para revisión. Aún no se ha guardado ni publicado nada.')
    } catch (error) {
      setImportPreview(null)
      setMessage(error.message || 'No se pudo leer ese Excel.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: evoBrand.border }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: evoBrand.accent }}>
            Preparar IA
          </p>
          <h2 className="mt-1 font-evo-display text-xl font-bold" style={{ color: evoBrand.text }}>
            Contexto de la semana completa
          </h2>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: evoBrand.muted }}>
            Aquí guardas el contexto común de todas las clases: objetivo del ciclo, normas, restricciones y referencias. Se conserva dentro del borrador semanal y queda listo para el generador asistido.
          </p>
        </div>
        <button type="button" onClick={save} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: evoBrand.accent }}>
          {saving ? 'Guardando…' : 'Guardar contexto'}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {EVO_AI_CONTEXT_FIELDS.map(({ key, label, placeholder }) => (
          <label key={key} className="grid gap-1.5">
            <span className="text-sm font-semibold" style={{ color: evoBrand.text }}>{label}</span>
            <textarea
              value={context[key]}
              onChange={(event) => update(key, event.target.value)}
              placeholder={placeholder}
              rows={3}
              maxLength={5000}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: evoBrand.border, color: evoBrand.text }}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 rounded-xl border p-4" style={{ borderColor: evoBrand.border, backgroundColor: '#FAF7FC' }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold" style={{ color: evoBrand.text }}>Vista previa que recibirá la IA</p>
          <button type="button" onClick={copyPreview} className="text-sm font-semibold" style={{ color: evoBrand.accent }}>
            Copiar
          </button>
        </div>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs leading-5" style={{ color: evoBrand.muted }}>
          {preview}
        </pre>
      </div>

      <div className="mt-5 rounded-xl border p-4" style={{ borderColor: evoBrand.border }}>
        <p className="text-sm font-bold" style={{ color: evoBrand.text }}>Revisar Excel de Programming</p>
        <p className="mt-1 text-sm" style={{ color: evoBrand.muted }}>
          Lee un Excel descargado de Programming, detecta las sesiones y el feedback, y te enseña el resultado antes de importarlo. No guarda ni publica nada.
        </p>
        <input ref={fileInputRef} className="hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={reviewExcel} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing} className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60" style={{ borderColor: evoBrand.accent, color: evoBrand.accent }}>
          {importing ? 'Leyendo Excel…' : 'Seleccionar Excel para revisar'}
        </button>

        {importPreview ? (
          <>
            <Pe2ExcelImportReview review={importPreview} />
            <button
              type="button"
              onClick={prepareWeeklyPlan}
              className="mt-3 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: evoBrand.accent }}
            >
              Preparar borrador semanal editable
            </button>
          </>
        ) : null}
      </div>

      <Pe2WeeklyDraftBoard
        plan={weeklyPlan}
        saving={saving}
        onChange={setWeeklyPlan}
        onSave={saveWeeklyPlan}
      />

      <Pe2WeeklyTeamReview
        plan={weeklyPlan}
        prepared={teamReviewPrepared}
        saving={saving}
        onPrepare={() => setReviewPrepared(true)}
        onReturnToDraft={() => setReviewPrepared(false)}
      />

      {message ? <p className="mt-3 text-sm" style={{ color: message.startsWith('No se pudo') ? '#B42318' : '#18794E' }}>{message}</p> : null}
    </section>
  )
}
