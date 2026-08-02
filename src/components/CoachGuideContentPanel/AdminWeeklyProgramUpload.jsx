import { Component, useMemo, useState } from 'react'
import {
  listPublishedWeekVersionsForMesocycle,
  upsertPublishedWeekBySlot,
} from '../../lib/supabase.js'
import { generateCreativeProgrammingSuggestions } from '../../utils/analyzeWeeklyProgramXlsx.js'
import {
  normalizeWeekDataForEditor,
  weekHasMeaningfulSessionContent,
} from '../../utils/normalizeWeekDataForEditor.js'
import { validateEvoWeek } from '../../domain/method/validators/validateEvoWeek.js'
import {
  buildPublicationQualityGate,
  buildPublicationTargetFingerprint,
  hashPublicationValue,
} from '../../utils/publicationQualityGate.js'
import {
  parseWeeklyOfferSelection,
  weeklyOfferSelectionToValidationOffer,
} from '../../utils/weeklyOffer.js'
import {
  addProgrammingDays,
  selectProgrammingContextWeeks,
} from '../../utils/programmingContextSelection.js'

const MESO_OPTS = ['fuerza', 'autocarga', 'mixto']

/**
 * Lee un File a ArrayBuffer. Si la referencia del input se ha quedado obsoleta (el archivo se
 * movió o se volvió a guardar tras seleccionarlo), el navegador lanza un NotFoundError con un
 * mensaje críptico; aquí lo traducimos a algo accionable.
 */
async function readFileAsArrayBuffer(file) {
  try {
    return await file.arrayBuffer()
  } catch (e) {
    const name = e?.name || ''
    const msg = String(e?.message || '')
    if (name === 'NotFoundError' || /could not be found|no longer be read|not be found/i.test(msg)) {
      throw new Error(
        'El archivo seleccionado ya no está disponible (se ha movido o se volvió a guardar tras elegirlo). Vuelve a pulsar «Seleccionar archivo», elígelo de nuevo y reintenta.',
      )
    }
    throw e
  }
}

/** Convierte un ArrayBuffer a base64 sin reventar la pila con archivos grandes. */
function arrayBufferToBase64(ab) {
  const bytes = new Uint8Array(ab)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Analiza el .xlsx en el servidor (api/analyze-weekly-program). ExcelJS no parsea de forma
 * fiable en el navegador, así que subimos el archivo en base64 y devolvemos el informe ya
 * calculado en Node.
 */
async function analyzeViaApi({ buffer, mesocycle, week, phase, previousWeekData, historicalWeeksData, scope }) {
  const fileBase64 = arrayBufferToBase64(buffer)
  const res = await fetch('/api/analyze-weekly-program', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64,
      mesocycle,
      week,
      phase,
      previousWeekData,
      historicalWeeksData,
      scope,
    }),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = json?.error || `Error del servidor al analizar (HTTP ${res.status}).`
    throw new Error(msg)
  }
  if (!json || typeof json !== 'object') {
    throw new Error('El servidor no devolvió un informe válido.')
  }
  return json
}
const WEEK_OPTS = Array.from({ length: 12 }, (_, i) => i + 1)

const SAFE_POINTS_FALLBACK = { estructura: 0, variedad: 0, coherencia: 0, feedback: 0 }

function fileIdentity(file) {
  return file
    ? {
        name: String(file.name || ''),
        size: Number(file.size || 0),
        lastModified: Number(file.lastModified || 0),
      }
    : null
}

function historyRowIdentity(row) {
  return {
    id: String(row?.id || ''),
    week: Number(row?.semana || 0),
    publishedAt: String(row?.published_at || ''),
    publicationStatus: String(row?.publication_status || ''),
    version: Number(row?.version_number || 0),
    contentFingerprint:
      String(row?.content_fingerprint || '') || hashPublicationValue(row?.data || null),
  }
}

function stringifyRow(x) {
  if (x == null) return ''
  if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return String(x)
  try {
    return JSON.stringify(x)
  } catch {
    return String(x)
  }
}

/** Evita tirar React entero si el informe viene con un campo raro de Excel/legacy. */
class AdminWeeklyProgramUploadBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }

  static getDerivedStateFromError(err) {
    return { err }
  }

  render() {
    const { err } = this.state
    if (!err) return this.props.children
    const msg = err?.message || String(err)
    return (
      <div className="rounded-xl border border-red-500/50 bg-red-950/35 px-4 py-4 text-sm text-red-100 space-y-2">
        <p className="font-evo-display font-bold uppercase tracking-wide">Error al mostrar el análisis</p>
        <p className="text-xs opacity-90 break-words">{msg}</p>
        <p className="text-[10px] text-[#F6E8F9]/70">
          Abre la consola del navegador (F12 → Consola) para el stack trace, o recarga la página y prueba otro archivo.
        </p>
        <button
          type="button"
          className="h-10 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase text-xs"
          onClick={() => this.setState({ err: null })}
        >
          Reintentar vista
        </button>
      </div>
    )
  }
}

function AdminWeeklyProgramUploadInner({ adminSecret = '', onAdminSecretChange }) {
  const [file, setFile] = useState(null)
  const [batchFiles, setBatchFiles] = useState([])
  const [mesocycle, setMesocycle] = useState('autocarga')
  const [week, setWeek] = useState(1)
  const [phase, setPhase] = useState('')
  const [cycleStartDate, setCycleStartDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  /** Contexto histórico exacto usado por el análisis; cualquier cambio invalida su aprobación. */
  const [analysisContextRows, setAnalysisContextRows] = useState(null)
  const [analysisFingerprint, setAnalysisFingerprint] = useState('')
  const [batchResult, setBatchResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [partialWeekMode, setPartialWeekMode] = useState(true)
  const [experienciaEvoEnabled, setExperienciaEvoEnabled] = useState(true)
  const [creativeGoal, setCreativeGoal] = useState('equilibrio')
  const [creativeIdeas, setCreativeIdeas] = useState([])
  /** Tras analizar: guardar JSON en Supabase sin cambiar qué semana ven los coaches. */
  const [subirHubAutomatico, setSubirHubAutomatico] = useState(false)
  const [hubDraftVersion, setHubDraftVersion] = useState(null)

  const canAnalyze = !!file && !!cycleStartDate && !busy
  const canBatchAnalyze = batchFiles.length > 0 && !batchBusy

  function invalidateAnalysis() {
    setResult(null)
    setAnalysisContextRows(null)
    setAnalysisFingerprint('')
    setCreativeIdeas([])
    setImportMsg('')
    setHubDraftVersion(null)
  }

  async function loadExactHistoryContext() {
    if (!cycleStartDate) {
      throw new Error('Indica la fecha real de inicio del ciclo antes de analizar.')
    }
    const publishedVersions = await listPublishedWeekVersionsForMesocycle(mesocycle)
    const target = {
      mesociclo: mesocycle,
      semana: Number(week),
      cycle_id: `${mesocycle}:${cycleStartDate}`,
      cycle_start_date: cycleStartDate,
      week_start_date: addProgrammingDays(cycleStartDate, (Number(week) - 1) * 7),
    }
    const selection = selectProgrammingContextWeeks(publishedVersions, target, {
      progressionLimit: 6,
      historicalLimit: 0,
    })
    if (selection.mode !== 'exact-cycle-date') {
      throw new Error('No se pudo verificar el ciclo exacto del Excel.')
    }
    const rows = selection.progressionWeeks
    const previousRow =
      rows.find((row) => Number(row?.semana) === Number(week) - 1) || null
    return {
      previousRow,
      rows,
      mode: selection.mode,
      selectedWeekIds: selection.selectedWeekIds,
      identity: rows.map(historyRowIdentity),
    }
  }

  function buildAdminContextFingerprint(contextRows = analysisContextRows) {
    return hashPublicationValue({
      target: {
        mesocycle,
        week: Number(week),
        phase: String(phase || '').trim(),
        cycleStartDate,
        weekStartDate: addProgrammingDays(cycleStartDate, (Number(week) - 1) * 7),
      },
      file: fileIdentity(file),
      scope: {
        partialWeek: partialWeekMode,
        activeClassesOnly: partialWeekMode,
        draftMode: partialWeekMode,
        experienciaEvo: experienciaEvoEnabled,
      },
      history: contextRows?.identity || [],
    })
  }

  function buildHubPayload() {
    if (!result?.parsedWeekData) return null
    try {
      return normalizeWeekDataForEditor(
        {
          ...result.parsedWeekData,
          mesociclo: mesocycle,
          semana: Number(week),
          phase: String(phase || '').trim(),
          cycle_id: `${mesocycle}:${cycleStartDate}`,
          cycle_start_date: cycleStartDate,
          week_start_date: addProgrammingDays(cycleStartDate, (Number(week) - 1) * 7),
        },
        { semana: Number(week), mesociclo: mesocycle },
      )
    } catch {
      return null
    }
  }

  const hubPayloadPreview = useMemo(
    () => buildHubPayload(),
    [cycleStartDate, mesocycle, phase, result, week],
  )
  const explicitOfferSelection = useMemo(
    () => parseWeeklyOfferSelection(hubPayloadPreview?.oferta_semanal),
    [hubPayloadPreview],
  )
  const currentAdminContextFingerprint = useMemo(
    () => buildAdminContextFingerprint(),
    [
      analysisContextRows,
      cycleStartDate,
      experienciaEvoEnabled,
      file,
      mesocycle,
      partialWeekMode,
      phase,
      week,
    ],
  )
  const currentAdminTargetFingerprint = useMemo(
    () =>
      hubPayloadPreview
        ? buildPublicationTargetFingerprint({
            weekData: hubPayloadPreview,
            mesocycle,
            week,
            phase,
            offer: hubPayloadPreview?.oferta_semanal || null,
            contextFingerprint: currentAdminContextFingerprint,
          })
        : '',
    [
      currentAdminContextFingerprint,
      hubPayloadPreview,
      mesocycle,
      phase,
      week,
    ],
  )
  const currentAdminMethodReview = useMemo(
    () =>
      hubPayloadPreview
        ? validateEvoWeek(hubPayloadPreview, {
            ...(explicitOfferSelection
              ? { offer: weeklyOfferSelectionToValidationOffer(explicitOfferSelection) }
              : {}),
            previousWeeks: (analysisContextRows?.rows || [])
              .map((row) => row?.data)
              .filter(Boolean),
            allowFestivo: false,
          })
        : { errors: [], warnings: [] },
    [analysisContextRows, explicitOfferSelection, hubPayloadPreview],
  )
  const currentAdminQualityGate = useMemo(
    () =>
      buildPublicationQualityGate({
        evaluation: result,
        evaluationFingerprint: analysisFingerprint,
        targetFingerprint: currentAdminTargetFingerprint,
        methodErrors: (currentAdminMethodReview?.errors || []).map(
          (entry) => entry?.message || String(entry),
        ),
        contextReady:
          !!cycleStartDate &&
          analysisContextRows?.mode === 'exact-cycle-date',
        extraBlockers: explicitOfferSelection
          ? []
          : ['La oferta semanal exacta no está confirmada en el documento importado. Guárdalo como borrador y confírmala en el generador.'],
      }),
    [
      analysisContextRows,
      analysisFingerprint,
      cycleStartDate,
      currentAdminMethodReview,
      currentAdminTargetFingerprint,
      explicitOfferSelection,
      result,
    ],
  )
  const canSubirAlHub =
    !!hubPayloadPreview && weekHasMeaningfulSessionContent(hubPayloadPreview) && !importing && !busy
  /** Botón visible tras analizar aunque falle el chequeo de contenido (al pulsar se muestra el motivo). */
  const showSubirHubButton = !!(result?.parsedWeekData && !busy)

  const statusBadgeClass = useMemo(() => {
    const key = result?.kpi?.status || result?.validationOutcome?.key
    if (key === 'bloqueado') return 'bg-red-950/80 border-red-500/60 text-red-100'
    if (key === 'revision_necesaria') return 'bg-orange-950/60 border-orange-500/50 text-orange-100'
    if (key === 'aprobado_con_alertas') return 'bg-amber-950/50 border-amber-500/50 text-amber-100'
    return 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'
  }, [result])

  const bucketClass = useMemo(() => {
    if (!result) return 'text-[#F6E8F9]'
    const key = result?.kpi?.status || result?.validationOutcome?.key
    if (key === 'bloqueado') return 'text-red-300'
    if (key === 'revision_necesaria') return 'text-orange-300'
    if (key === 'aprobado_con_alertas') return 'text-amber-300'
    return 'text-emerald-300'
  }, [result])

  const alertsSafe = Array.isArray(result?.alerts) ? result.alerts : []
  const observationsSafe = Array.isArray(result?.reviewObservations) ? result.reviewObservations : []
  const blockingSafe = Array.isArray(result?.blockingReasons) ? result.blockingReasons : []
  const pendingSafe = Array.isArray(result?.pendingCorrections)
    ? result.pendingCorrections
    : Array.isArray(result?.failed)
      ? result.failed
      : []
  const pointsSafe =
    result?.points && typeof result.points === 'object' && result.points !== null
      ? result.points
      : SAFE_POINTS_FALLBACK

  async function handleAnalyze() {
    if (!file) return
    setBusy(true)
    setError('')
    setImportMsg('')
    setAnalysisFingerprint('')
    setAnalysisContextRows(null)
    try {
      const buf = await readFileAsArrayBuffer(file)
      const exactContext = await loadExactHistoryContext()
      const previousWeekData = exactContext.previousRow?.data || null
      const historicalWeeksData = exactContext.rows
        .map((row) => row?.data)
        .filter(Boolean)
      const out = await analyzeViaApi({
        buffer: buf,
        mesocycle,
        week: Number(week),
        phase,
        previousWeekData,
        historicalWeeksData,
        scope: {
          partialWeek: partialWeekMode,
          activeClassesOnly: partialWeekMode,
          draftMode: partialWeekMode,
          experienciaEvo: experienciaEvoEnabled,
        },
      })
      const normalized = normalizeWeekDataForEditor(
        {
          ...out.parsedWeekData,
          mesociclo: mesocycle,
          semana: Number(week),
          phase: String(phase || '').trim(),
          cycle_id: `${mesocycle}:${cycleStartDate}`,
          cycle_start_date: cycleStartDate,
          week_start_date: addProgrammingDays(cycleStartDate, (Number(week) - 1) * 7),
        },
        { semana: Number(week), mesociclo: mesocycle },
      )
      const contextFingerprint = buildAdminContextFingerprint(exactContext)
      const targetFingerprint = buildPublicationTargetFingerprint({
        weekData: normalized,
        mesocycle,
        week,
        phase,
        offer: normalized?.oferta_semanal || null,
        contextFingerprint,
      })
      setAnalysisContextRows(exactContext)
      setAnalysisFingerprint(targetFingerprint)
      setResult(out)
      setCreativeIdeas(
        generateCreativeProgrammingSuggestions({
          weekData: out?.parsedWeekData,
          objective: creativeGoal,
          historicalInsights: out?.historicalInsights,
        }),
      )
      if (subirHubAutomatico && out?.parsedWeekData) {
        if (weekHasMeaningfulSessionContent(normalized)) {
          setImporting(true)
          try {
            const r = await upsertPublishedWeekBySlot(normalized, mesocycle, Number(week), {
              activateForHub: false,
              adminSecret,
              contentFingerprint: targetFingerprint,
              qualityGate: buildPublicationQualityGate({
                evaluation: out,
                evaluationFingerprint: targetFingerprint,
                targetFingerprint,
                contextReady: true,
                extraBlockers: parseWeeklyOfferSelection(normalized?.oferta_semanal)
                  ? []
                  : ['La oferta semanal exacta no está confirmada en el documento importado.'],
              }),
              draftId: hubDraftVersion?.id || null,
              expectedRevision: hubDraftVersion?.id
                ? Number(hubDraftVersion.revision)
                : 0,
            })
            if (r?.active) {
              throw new Error('El servidor intentó activar una importación que debía quedar como borrador.')
            }
            setHubDraftVersion({ id: r.id, revision: Number(r.revision) })
            setImportMsg(
              'Borrador guardado en Supabase (la semana visible para coaches no ha cambiado). Abre «Generar programación semanal» con el ciclo y semana correctos para editar y validar.',
            )
            try {
              window.dispatchEvent(new CustomEvent('evo-active-week-updated', { detail: { source: 'admin-weekly-upload-auto' } }))
            } catch {
              /* noop */
            }
          } catch (upErr) {
            const msg = upErr?.message || String(upErr)
            setError(
              `Subida automática fallida: ${msg}. Revisa permisos Supabase (RLS) o vuelve a intentar con «Guardar borrador en Hub».`,
            )
          } finally {
            setImporting(false)
          }
        }
      }
    } catch (e) {
      setError(e?.message || 'No se pudo analizar el Excel')
      setResult(null)
      setAnalysisFingerprint('')
      setAnalysisContextRows(null)
    } finally {
      setBusy(false)
    }
  }

  function handleGenerateCreativeIdeas() {
    if (!result?.parsedWeekData) return
    const ideas = generateCreativeProgrammingSuggestions({
      weekData: result.parsedWeekData,
      objective: creativeGoal,
      historicalInsights: result.historicalInsights,
    })
    setCreativeIdeas(ideas)
  }

  function inferWeekFromFileName(name, fallback) {
    const s = String(name || '')
    const m1 = s.match(/(?:^|[\s_\-])(?:S|s)(\d{1,2})(?=\b|[\s_\-]|\.)/)
    const m2 = s.match(/\b(?:s|semana)\s*([0-9]{1,2})\b/i)
    const n = Number((m1 || m2)?.[1])
    if (Number.isFinite(n) && n >= 1 && n <= 52) return n
    return fallback
  }

  async function handleAnalyzeBatch() {
    if (!batchFiles.length) return
    setBatchBusy(true)
    setError('')
    setImportMsg('')
    setBatchResult(null)
    try {
      const filesSorted = [...batchFiles].sort((a, b) => inferWeekFromFileName(a.name, 999) - inferWeekFromFileName(b.name, 999))
      const rows = []
      const alertFreq = new Map()
      const recFreq = new Map()
      let prevParsedWeek = null
      for (let i = 0; i < filesSorted.length; i += 1) {
        const f = filesSorted[i]
        const detectedWeek = inferWeekFromFileName(f.name, i + 1)
        const buf = await readFileAsArrayBuffer(f)
        const out = await analyzeViaApi({
          buffer: buf,
          mesocycle,
          week: detectedWeek,
          phase,
          previousWeekData: prevParsedWeek,
          historicalWeeksData: rows.map((r) => r.parsedWeekData).filter(Boolean).slice(-4),
          scope: {
            partialWeek: partialWeekMode,
            activeClassesOnly: partialWeekMode,
            draftMode: partialWeekMode,
            experienciaEvo: experienciaEvoEnabled,
          },
        })
        rows.push({
          fileName: f.name,
          week: detectedWeek,
          score: out.score,
          statusLabel: out.kpi?.statusLabel || out.validationOutcome?.label,
          basicScore: out.basicScore,
          qualityScore: out.qualityScore,
          alertsCount: out.alerts.length,
          pendingCount: out.pendingCorrections?.length ?? 0,
          blockingCount: out.blockingReasons?.length ?? 0,
          topAlert: out.alerts[0] || 'Sin alertas',
          topRecommendation: out.smartRecommendations?.[0] || 'Sin recomendación',
          parsedWeekData: out.parsedWeekData,
        })
        prevParsedWeek = out.parsedWeekData
        for (const a of out.alerts || []) {
          const key = String(a).trim().toLowerCase()
          alertFreq.set(key, (alertFreq.get(key) || 0) + 1)
        }
        for (const r of out.smartRecommendations || []) {
          const key = String(r).trim().toLowerCase()
          recFreq.set(key, (recFreq.get(key) || 0) + 1)
        }
      }
      const avg =
        rows.length > 0
          ? Math.round(rows.reduce((acc, r) => acc + Number(r.score || 0), 0) / rows.length)
          : 0
      const topAlerts = [...alertFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([text, count]) => ({ text, count }))
      const topRecs = [...recFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([text, count]) => ({ text, count }))

      setBatchResult({
        totalFiles: rows.length,
        averageScore: avg,
        rows,
        topAlerts,
        topRecs,
      })
      setImportMsg('Lote analizado. Revisa patrones repetidos y valor real de recomendaciones.')
    } catch (e) {
      setError(e?.message || 'No se pudo analizar el lote de semanas')
    } finally {
      setBatchBusy(false)
    }
  }

  async function handleGuardarBorradorHub() {
    setError('')
    setImportMsg('')
    if (!result?.parsedWeekData) {
      setError('Primero analiza el Excel con el botón morado.')
      return
    }
    const normalized = buildHubPayload()
    if (!normalized) {
      setError('No se pudo preparar los datos. Vuelve a analizar el archivo.')
      return
    }
    if (!weekHasMeaningfulSessionContent(normalized)) {
      setError(
        'No hay texto de sesión reconocible (solo celdas vacías o «no programada»). Revisa mesociclo/semana, el Excel o desactiva modo borrador si la hoja está incompleta.',
      )
      return
    }
    setImporting(true)
    try {
      const savedDraft = await upsertPublishedWeekBySlot(normalized, mesocycle, Number(week), {
        activateForHub: false,
        adminSecret,
        contentFingerprint: currentAdminTargetFingerprint,
        qualityGate: currentAdminQualityGate,
        draftId: hubDraftVersion?.id || null,
        expectedRevision: hubDraftVersion?.id
          ? Number(hubDraftVersion.revision)
          : 0,
      })
      if (savedDraft?.active) {
        throw new Error('El servidor intentó activar una importación que debía quedar como borrador.')
      }
      setHubDraftVersion({
        id: savedDraft.id,
        revision: Number(savedDraft.revision),
      })
      setImportMsg(
        'Borrador guardado en Supabase para este ciclo y semana. Los coaches siguen viendo la versión activa; abre «Generar programación semanal» para completar la revisión y publicar.',
      )
      try {
        window.dispatchEvent(new CustomEvent('evo-active-week-updated', { detail: { source: 'admin-weekly-upload-draft' } }))
      } catch {
        /* noop */
      }
    } catch (e) {
      const msg = e?.message || String(e)
      setError(
        `No se pudo guardar el borrador: ${msg}${/policy|rls|permission|42501/i.test(msg) ? ' — Revisa políticas RLS de published_weeks para INSERT/UPDATE con la anon key.' : ''}`,
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleExportReport() {
    if (!result?.reportText) return
    try {
      await navigator.clipboard.writeText(result.reportText)
      setImportMsg('Informe copiado al portapapeles.')
      setTimeout(() => setImportMsg(''), 2500)
    } catch {
      setImportMsg('No se pudo copiar automáticamente.')
      setTimeout(() => setImportMsg(''), 2500)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#6A1F6D]/60 bg-[#221427]/80 px-4 py-3 space-y-2">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#FFFF4C]/90 font-bold">
            Clave de administración (obligatoria para guardar)
          </span>
          <input
            type="password"
            autoComplete="off"
            value={adminSecret}
            onChange={(e) => onAdminSecretChange?.(e.target.value)}
            placeholder="Pega aquí COACH_GUIDE_ADMIN_SECRET (Vercel → programing-evo → Environment Variables)"
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9] placeholder:text-[#F6E8F9]/40"
          />
        </label>
        <p className="text-[10px] text-[#F6E8F9AA] leading-relaxed">
          {adminSecret.trim()
            ? 'Clave guardada en esta sesión. Ya puedes usar «Guardar borrador en Hub».'
            : 'Copia el valor de COACH_GUIDE_ADMIN_SECRET en Vercel y pégalo aquí. Se guarda al escribir (no hace falta ir a otra pestaña).'}
        </p>
      </div>

      <p className="text-sm text-[#F6E8F9CC]">
        Sube un Excel y analízalo. Por defecto puedes <span className="font-semibold text-[#F6E8F9]">guardar borrador en Supabase</span> para la
        semana y ciclo exactos <span className="font-semibold">sin cambiar</span> la versión que ven los coaches. Las importaciones quedan siempre
        como borrador: abre después «Generar programación semanal» para revisar contexto, oferta y feedback antes de publicar.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="space-y-1 md:col-span-2">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Archivo .xlsx</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              const f = e.target.files?.[0] || null
              invalidateAnalysis()
              setFile(f)
              if (f?.name) {
                const inferred = inferWeekFromFileName(f.name, week)
                if (inferred !== week) setWeek(inferred)
              }
            }}
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Mesociclo activo</span>
          <select
            value={mesocycle}
            onChange={(e) => {
              invalidateAnalysis()
              setMesocycle(e.target.value)
            }}
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          >
            {MESO_OPTS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Semana</span>
          <select
            value={week}
            onChange={(e) => {
              invalidateAnalysis()
              setWeek(Number(e.target.value))
            }}
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          >
            {WEEK_OPTS.map((w) => (
              <option key={w} value={w}>
                S{w}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Inicio real del ciclo</span>
          <input
            type="date"
            required
            value={cycleStartDate}
            onChange={(e) => {
              invalidateAnalysis()
              setCycleStartDate(e.target.value)
            }}
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          />
          <span className="block text-[10px] text-[#F6E8F9AA]">
            Evita mezclar esta S{week} con otra del mismo mesociclo.
          </span>
        </label>
        <label className="space-y-1 block">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Fase (opcional, para informe)</span>
          <input
            value={phase}
            onChange={(e) => {
              invalidateAnalysis()
              setPhase(e.target.value)
            }}
            placeholder="Ej.: Volumen mixto"
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-[#F6E8F9CC]">
        <input
          type="checkbox"
          checked={partialWeekMode}
          onChange={(e) => {
            invalidateAnalysis()
            setPartialWeekMode(e.target.checked)
          }}
        />
        Modo semana parcial / draft (no penaliza plantilla incompleta)
      </label>
      <label className="inline-flex items-center gap-2 text-xs text-[#F6E8F9CC]">
        <input
          type="checkbox"
          checked={experienciaEvoEnabled}
          onChange={(e) => {
            invalidateAnalysis()
            setExperienciaEvoEnabled(e.target.checked)
          }}
        />
        Capa Experiencia EVO (lectura cualitativa; no cambia el score técnico)
      </label>
      <label className="inline-flex items-center gap-2 text-xs text-[#F6E8F9CC]">
        <input
          type="checkbox"
          checked={subirHubAutomatico}
          onChange={(e) => setSubirHubAutomatico(e.target.checked)}
        />
        Tras analizar, guardar borrador en Supabase automáticamente (no cambia la semana visible para coaches)
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Objetivo assistant creativo</span>
          <input
            value={creativeGoal}
            onChange={(e) => setCreativeGoal(e.target.value)}
            placeholder="Ej.: más atlética / menos caos logístico / más pedagógica"
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          />
        </label>
        <button
          type="button"
          onClick={handleGenerateCreativeIdeas}
          disabled={!result}
          className="h-11 mt-auto px-4 rounded-lg bg-[#4C1D95] text-white font-evo-display uppercase disabled:opacity-50"
        >
          Generar ideas
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="h-11 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase disabled:opacity-50"
        >
          {busy ? 'Analizando…' : 'Analizar antes de importar'}
        </button>
        {showSubirHubButton ? (
          <button
            type="button"
            onClick={handleGuardarBorradorHub}
            disabled={importing || busy}
            title={canSubirAlHub ? '' : 'Tras analizar, debería haber texto en Funcional/Basics/Fit. Si no, verás el error al pulsar.'}
            className="h-11 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-evo-display uppercase disabled:opacity-50 shadow-lg shadow-emerald-900/40"
          >
            {importing ? 'Guardando…' : 'Guardar borrador en Hub'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleExportReport}
          disabled={!result}
          className="h-11 px-4 rounded-lg bg-[#A729AD] text-white font-evo-display uppercase disabled:opacity-50"
        >
          Exportar informe
        </button>
      </div>

      <div className="rounded-xl border border-[#6A1F6D]/40 bg-[#221427] p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Laboratorio real (lote de semanas)</p>
        <p className="text-xs text-[#F6E8F9CC]">
          Sube varias semanas .xlsx para validar el sistema con casos reales (fuerza/autocarga/mixto, simples/complejas) sin añadir reglas nuevas.
        </p>
        <input
          type="file"
          multiple
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setBatchFiles(Array.from(e.target.files || []))}
          className="w-full h-11 rounded-lg bg-[#1A0F1E] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAnalyzeBatch}
            disabled={!canBatchAnalyze}
            className="h-10 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase disabled:opacity-50"
          >
            {batchBusy ? 'Analizando lote…' : `Analizar lote (${batchFiles.length})`}
          </button>
          {batchFiles.length ? <p className="text-xs text-[#F6E8F9AA]">{batchFiles.length} archivo(s) cargados</p> : null}
        </div>
        {batchResult ? (
          <div className="space-y-2">
            <p className="text-xs text-emerald-200">
              Resultado lote: {batchResult.totalFiles} semanas · Score medio {batchResult.averageScore}/100
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {batchResult.rows.map((r) => (
                <p key={`${r.fileName}-${r.week}`} className="text-xs text-[#F6E8F9]">
                  S{r.week} · {r.statusLabel || '—'} · {r.fileName} · {r.score}/100 · bás. {r.basicScore} · cal. {r.qualityScore} · ⚠ {r.alertsCount} ·
                  pend. {r.pendingCount}
                  {r.blockingCount ? ` · bloq. ${r.blockingCount}` : ''}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="rounded-lg border border-[#6A1F6D]/30 px-2 py-2">
                <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA] mb-1">Alertas más repetidas</p>
                {(batchResult.topAlerts || []).map((a, i) => (
                  <p key={`ta-${i}`} className="text-xs text-red-200">
                    - ({a.count}) {a.text}
                  </p>
                ))}
              </div>
              <div className="rounded-lg border border-[#6A1F6D]/30 px-2 py-2">
                <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA] mb-1">Recomendaciones más útiles (repetidas)</p>
                {(batchResult.topRecs || []).map((r, i) => (
                  <p key={`tr-${i}`} className="text-xs text-emerald-200">
                    - ({r.count}) {r.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {importMsg ? <p className="text-sm text-emerald-300">{importMsg}</p> : null}

      {result ? (
        <div className="rounded-xl border border-[#6A1F6D]/40 bg-[#221427] p-4 space-y-3">
          <div className="rounded-xl border-2 border-emerald-500/45 bg-gradient-to-br from-emerald-950/55 to-[#0f2818]/80 px-4 py-4 space-y-3 shadow-lg shadow-emerald-950/40">
            <div>
              <p className="text-[10px] font-evo-display font-bold uppercase tracking-[0.14em] text-emerald-300/95">
                Paso 2 · Supabase y Hub
              </p>
              <p className="text-xs text-[#E8FDE8]/90 mt-1 leading-relaxed">
                <span className="font-semibold text-white">Guardar borrador</span> escribe esta semana en Supabase para el mesociclo y número
                elegidos <span className="font-semibold">sin</span> cambiar lo que los coaches ven. Por seguridad, un Excel importado no se publica
                desde este panel: debe abrirse y validarse dentro de «Generar programación semanal».
              </p>
            </div>
            {showSubirHubButton ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGuardarBorradorHub}
                  disabled={importing || busy}
                  className="flex-1 min-h-[3rem] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-evo-display font-bold uppercase tracking-wide text-sm shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  {importing ? 'Guardando borrador…' : 'Guardar borrador en Hub'}
                </button>
                <p className="text-[10px] text-amber-200/90">
                  Importación = borrador. La publicación final solo está disponible en el generador tras comprobar el ciclo exacto.
                </p>
              </div>
            ) : (
              <p className="text-xs text-amber-200/95 border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-950/40">
                Analiza de nuevo tras elegir archivo y mesociclo/semana; si ya analizaste y falla esto, revisa el mensaje de error superior.
              </p>
            )}
            {showSubirHubButton && !busy && !importing ? (
              <p className="text-[10px] text-[#F6E8F9]/70">
                {(currentAdminQualityGate.blockers || [])[0] ||
                  (currentAdminQualityGate.pending || [])[0] ||
                  'El análisis está completo; guarda el archivo como borrador y finaliza la revisión en el generador.'}
              </p>
            ) : null}
          </div>
          <div className={`rounded-lg border px-3 py-2 text-sm font-evo-display uppercase tracking-wide ${statusBadgeClass}`}>
            {result.kpi?.statusLabel || result.validationOutcome?.label || '—'}
          </div>
          <p className={`text-lg font-extrabold ${bucketClass}`}>Score: {result.score}/100</p>
          {(result.kpi?.status || result.validationOutcome?.key) === 'bloqueado' ? (
            <p className="text-[10px] text-red-200">
              La nota queda limitada mientras exista un bloqueo. Los subindicadores son diagnóstico, no una aprobación.
            </p>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">
              Validación básica: {result.basicScore ?? result.score}/100
            </p>
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">
              Calidad de programación: {result.qualityScore ?? result.score}/100
            </p>
            {result.experienciaEvo?.enabled ? (
              <p className="rounded-lg border border-cyan-700/40 px-2 py-1 text-cyan-100">
                Experiencia EVO: {result.experienciaEvo.indiceExperienciaSemana}/100
              </p>
            ) : (
              <p className="rounded-lg border border-[#6A1F6D]/20 px-2 py-1 text-[#F6E8F9AA]">
                Experiencia EVO: desactivada
              </p>
            )}
          </div>
          {result.experienciaEvo?.enabled ? (
            <div className="rounded-lg border border-cyan-700/35 bg-[#0f1729] px-3 py-2 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-cyan-300/90">Experiencia EVO (cualitativa)</p>
              <p className="text-[10px] text-[#93C5FD]/80">
                Ritmo/pacing en texto y riqueza motriz están calculados como señales suaves peso reducido; no marcan errores que deban modificarse sí o sí.
              </p>
              <p className="text-xs text-[#E0F2FE]">{result.experienciaEvo.queHaceEspecialLaSemana}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#BAE6FD]">
                <p>Día más memorable: {result.experienciaEvo.diaMasMemorable || '—'}</p>
                <p>Día más plano: {result.experienciaEvo.diaMasPlano || '—'}</p>
              </div>
              <p className="text-xs text-amber-100/95">
                <span className="font-semibold text-amber-200">Opcional (pulir lectura clase): </span>
                {result.experienciaEvo.mejoraPrioritaria}
              </p>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cyan-400/80 mb-1">Vs semana anterior</p>
                <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                  {(result.experienciaEvo.mejorasVsSemanaAnterior || []).map((m, i) => (
                    <li key={`exp-${i}`} className="text-xs text-[#E0F2FE]">
                      - {m}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[10px] text-[#93C5FD]/90">{result.experienciaEvo.nota}</p>
            </div>
          ) : null}
          {result.evoExperienceScoring?.enabled ? (
            <div className="rounded-lg border border-fuchsia-600/40 bg-[#1a1024] px-3 py-2 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-fuchsia-300/90">
                Experiencia EVO · Scoring (factor más importante — sí mueve el score)
              </p>
              <p className="text-sm font-extrabold text-fuchsia-100">
                {result.evoExperienceScoring.score}/100
                <span className="ml-2 text-[10px] font-normal text-fuchsia-200/70">
                  base {result.evoExperienceScoring.base} · +{result.evoExperienceScoring.rewardSum} · −{result.evoExperienceScoring.penaltySum}
                </span>
              </p>
              {(result.evoExperienceScoring.rewards || []).length ? (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">Premia</p>
                  <ul className="space-y-0.5">
                    {result.evoExperienceScoring.rewards.map((r, i) => (
                      <li key={`evo-rw-${i}`} className="text-xs text-emerald-100/95">
                        + {r.points} · {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(result.evoExperienceScoring.penalties || []).length ? (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-rose-400/80 mb-1">Penaliza</p>
                  <ul className="space-y-0.5">
                    {result.evoExperienceScoring.penalties.map((p, i) => (
                      <li key={`evo-pn-${i}`} className="text-xs text-rose-100/95">
                        − {p.points} · {p.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">
              Estructura: {pointsSafe.estructura ?? 0}/25
            </p>
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">
              Variedad: {pointsSafe.variedad ?? 0}/25
            </p>
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">
              Coherencia: {pointsSafe.coherencia ?? 0}/25
            </p>
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">
              Feedback: {pointsSafe.feedback ?? 0}/25
            </p>
          </div>
          {result.parseDiagnostics ? (
            <details className="rounded-lg border border-violet-500/40 bg-[#1a1428] px-3 py-2">
              <summary className="cursor-pointer select-none text-[10px] font-evo-display uppercase tracking-widest text-violet-200/95">
                Depuración lectura Excel (hoja, trazas import, A/B/feedback, tiempos inferidos)
              </summary>
              <div className="mt-3 space-y-3 text-xs text-[#F0E8FF]/90">
                <p className="text-[10px] text-violet-200/75 leading-relaxed">
                  Útil para comprobar qué celda interpreta el parser y por qué un día aparece como ambiguo o el feedback sigue vacío en el modelo interno antes de cambiar la programación.
                </p>
                {Array.isArray(result.parseDiagnostics.importWarnings) &&
                result.parseDiagnostics.importWarnings.length ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-violet-300 mb-1">Avisos del import</p>
                    <ul className="max-h-32 overflow-y-auto space-y-0.5 font-mono text-[11px] text-amber-100/90">
                      {result.parseDiagnostics.importWarnings.map((w, i) => (
                        <li key={`iw-${i}`}>- {stringifyRow(w)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(result.parseDiagnostics.diasMarcadosAmbiguosSoloExcelScan?.length ||
                  result.parseDiagnostics.diasAmbiguosFinales?.length) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="rounded border border-violet-600/30 px-2 py-1">
                      <p className="text-[10px] uppercase text-violet-300 mb-0.5">Solo barrido Excel (ambiguo)</p>
                      <p className="font-mono text-[11px]">
                        {(result.parseDiagnostics.diasMarcadosAmbiguosSoloExcelScan || []).join(', ') || '—'}
                      </p>
                    </div>
                    <div className="rounded border border-violet-600/30 px-2 py-1">
                      <p className="text-[10px] uppercase text-violet-300 mb-0.5">Tras fusionar JSON importado</p>
                      <p className="font-mono text-[11px]">
                        {(result.parseDiagnostics.diasAmbiguosFinales || []).join(', ') || '—'}
                      </p>
                    </div>
                  </div>
                ) : null}
                {Array.isArray(result.parseDiagnostics.structureScanTrace) &&
                result.parseDiagnostics.structureScanTrace.length ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-violet-300 mb-1">Segunda pasada · estructura (hoja/rango)</p>
                    <ul className="max-h-36 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                      {result.parseDiagnostics.structureScanTrace.map((line, i) => (
                        <li key={`st-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(result.parseDiagnostics.excelImportParseTrace) &&
                result.parseDiagnostics.excelImportParseTrace.length ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-violet-300 mb-1">Trazas import (celda / clase / feedback / tiempo)</p>
                    <ul className="max-h-52 overflow-y-auto space-y-0.5 font-mono text-[10px] leading-snug text-[#E9D5FF]/85">
                      {result.parseDiagnostics.excelImportParseTrace.map((line, i) => (
                        <li key={`pt-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(result.parseDiagnostics.diasFlagsEscaneadas) &&
                result.parseDiagnostics.diasFlagsEscaneadas.length ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-violet-300 mb-1">Flags por día (Parte A / B / feedback en Excel)</p>
                    <div className="max-h-40 overflow-y-auto rounded border border-violet-600/25">
                      <table className="w-full text-left text-[10px] font-mono">
                        <thead>
                          <tr className="text-violet-200/80 border-b border-violet-600/30">
                            <th className="px-2 py-1">Día</th>
                            <th className="px-2 py-1">A</th>
                            <th className="px-2 py-1">B</th>
                            <th className="px-2 py-1">FB</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.parseDiagnostics.diasFlagsEscaneadas.map((row, i) => (
                            <tr key={`df-${i}`} className="border-b border-violet-800/20">
                              <td className="px-2 py-0.5">{row.dia}</td>
                              <td className="px-2 py-0.5">{row.tieneParteAExcel ? 'sí' : '—'}</td>
                              <td className="px-2 py-0.5">{row.tieneParteBExcel ? 'sí' : '—'}</td>
                              <td className="px-2 py-0.5">{row.tieneFeedbackEtiquetaExcel ? 'sí' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                {Array.isArray(result.parseDiagnostics.tiemposInferidosSesionNuCoreSample) &&
                result.parseDiagnostics.tiemposInferidosSesionNuCoreSample.length ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-violet-300 mb-1">
                      Muestra tiempos inferidos (TC / EMOM / Every / …)
                    </p>
                    <div className="max-h-44 overflow-y-auto rounded border border-violet-600/25">
                      <table className="w-full text-left text-[10px] font-mono">
                        <thead>
                          <tr className="text-violet-200/80 border-b border-violet-600/30">
                            <th className="px-2 py-1">Día</th>
                            <th className="px-2 py-1">Clase</th>
                            <th className="px-2 py-1">Min</th>
                            <th className="px-2 py-1">Formato</th>
                            <th className="px-2 py-1">Chars</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.parseDiagnostics.tiemposInferidosSesionNuCoreSample.map((row, i) => (
                            <tr key={`tt-${i}`} className="border-b border-violet-800/20">
                              <td className="px-2 py-0.5">{row.dia}</td>
                              <td className="px-2 py-0.5">{row.clase}</td>
                              <td className="px-2 py-0.5">{row.minInferidos}</td>
                              <td className="px-2 py-0.5">{row.formato ?? '—'}</td>
                              <td className="px-2 py-0.5">{row.longitudChars ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
          {result.coachReview ? (
            <div className="rounded-lg border border-[#6A1F6D]/30 px-3 py-2 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Lectura Head Coach · scoring cualitativo</p>
              <p className="text-[10px] text-[#F6E8F9]/60">
                Sesgo asistente (no tribunal): enlaza mejor con lo verde/rojo después de usar la app varias semanas.
              </p>
              <p className="text-xs text-red-200/95">Contraste técnico: {result.coachReview.risk}</p>
              <p className="text-xs text-amber-200/90">
                Opcional técnico: {result.coachReview.priority}
              </p>
              <p className="text-xs text-emerald-200">Fortalezas perceptibles: {result.coachReview.special}</p>
              <p className="text-xs text-[#F6E8F9]">Memorabilidad: {result.coachReview.memorable}</p>
              <p className="text-xs text-[#F6E8F9]">{result.coachReview.headCoach}</p>
            </div>
          ) : null}
          {blockingSafe.length ? (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-red-400/90 mb-1">Bloqueantes</p>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {blockingSafe.map((b, i) => (
                  <li key={`blk-${i}`} className="text-xs text-red-200">
                    - {stringifyRow(b)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pendingSafe.length ? (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-orange-300/90 mb-1">
                Correcciones / validaciones operativas
              </p>
              <p className="text-[10px] text-[#F6E8F9]/55 mb-1">
                Lista concreta; prioriza discrepancias reales sobre el box frente al Excel.
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {pendingSafe.slice(0, 80).map((f, i) => (
                  <li key={`pend-${i}`} className="text-xs text-orange-100">
                    - {stringifyRow(f)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {observationsSafe.length ? (
            <div className="rounded-lg border border-sky-500/25 bg-sky-950/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-sky-200/90 mb-1">Observaciones contextuales</p>
              <p className="text-[10px] text-[#BAE6FD]/80 mb-1.5">
                Heurísticas (A/B, tiempos estimados, pacing leído desde texto…): puedes ignorarlas si ya confías en la
                sesión tal cual está planteada.
              </p>
              <ul className="space-y-1 max-h-52 overflow-y-auto">
                {observationsSafe.slice(0, 140).map((o, i) => (
                  <li key={`obs-${i}-${stringifyRow(o).slice(0, 80)}`} className="text-xs text-sky-50/95">
                    - {stringifyRow(o)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA] mb-1">
              Avisos rápidos (checklist clase / publicación)
            </p>
            <ul className="space-y-1 max-h-44 overflow-y-auto">
              {alertsSafe.slice(0, 120).map((a, i) => (
                <li key={`${i}-${stringifyRow(a).slice(0, 120)}`} className="text-xs text-amber-200/95">
                  - {stringifyRow(a)}
                </li>
              ))}
              {!alertsSafe.length ? (
                <li className="text-xs text-emerald-200">- Sin avisos en esta categoría</li>
              ) : null}
            </ul>
          </div>
          {result.historicalInsights ? (
            <div className="rounded-lg border border-[#6A1F6D]/30 px-3 py-2 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Memoria del mesociclo</p>
              <p className="text-xs text-[#F6E8F9]">{result.historicalInsights.summary}</p>
              {(result.historicalInsights.bullets || []).map((b, i) => (
                <p key={`hist-${i}`} className="text-xs text-[#F6E8F9CC]">
                  - {b}
                </p>
              ))}
            </div>
          ) : null}
          {Array.isArray(result.smartRecommendations) && result.smartRecommendations.length ? (
            <div className="rounded-lg border border-[#6A1F6D]/30 px-3 py-2 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">
                Sugerencias Head Coach (opcionales · no son fallos)
              </p>
              {result.smartRecommendations.map((r, i) => (
                <p key={`rec-${i}`} className="text-xs text-emerald-200">
                  - {r}
                </p>
              ))}
            </div>
          ) : null}
          {Array.isArray(creativeIdeas) && creativeIdeas.length ? (
            <div className="rounded-lg border border-[#6A1F6D]/30 px-3 py-2 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">
                Inspiración · assistant creativo ({creativeGoal})
              </p>
              {creativeIdeas.map((idea, i) => (
                <p key={`idea-${i}`} className="text-xs text-[#F6E8F9]">
                  - {idea}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default function AdminWeeklyProgramUpload(props) {
  return (
    <AdminWeeklyProgramUploadBoundary>
      <AdminWeeklyProgramUploadInner {...props} />
    </AdminWeeklyProgramUploadBoundary>
  )
}
