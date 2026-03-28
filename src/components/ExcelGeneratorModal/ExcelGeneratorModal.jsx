import { useState, useRef, useEffect } from 'react'
import ExcelJS from 'exceljs'
import mammoth from 'mammoth'
import { SYSTEM_PROMPT_EXCEL, SYSTEM_PROMPT_REGENERATE_FEEDBACK } from '../../constants/systemPromptExcel.js'
import { generateWeekExcel } from '../../utils/generateExcel.js'
import {
  saveWeekToHistory,
  getHistoryForMesocycle,
  deleteWeekFromHistory,
  clearHistoryForMesocycle,
  formatHistoryAsContext,
} from '../../hooks/useWeekHistory.js'
import { publishWeek } from '../../lib/supabase.js'
import { getMethodText } from '../MethodPanel/MethodPanel.jsx'
import { AI_CONFIG } from '../../constants/config.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'

async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'txt') {
    return await file.text()
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const lines = []
    workbook.eachSheet((sheet) => {
      lines.push(`=== ${sheet.name} ===`)
      sheet.eachRow((row) => {
        const cells = []
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.text || cell.value
          if (v) cells.push(String(v).trim())
        })
        if (cells.length) lines.push(cells.join(' | '))
      })
    })
    return lines.join('\n')
  }

  if (ext === 'docx' || ext === 'doc') {
    const buffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    return result.value
  }

  throw new Error(`Formato no soportado (.${ext}). Usa .docx, .xlsx o .txt`)
}

const EDIT_SESSION_FIELDS = EVO_SESSION_CLASS_DEFS.map(({ key, label, color, feedbackKey }) => ({
  key,
  label,
  color,
  feedbackKey,
}))

function sessionFingerprintKey(diaIdx, sessionKey) {
  return `${diaIdx}::${sessionKey}`
}

function feedbackStaleKey(diaIdx, feedbackKey) {
  return `${diaIdx}::${feedbackKey}`
}

function buildSessionFingerprintMap(weekData) {
  const m = new Map()
  ;(weekData?.dias || []).forEach((dia, diaIdx) => {
    for (const { key } of EVO_SESSION_CLASS_DEFS) {
      m.set(sessionFingerprintKey(diaIdx, key), dia[key] ?? '')
    }
  })
  return m
}

function stripCodeFences(text) {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/s, '')
  }
  return t.trim()
}

export default function ExcelGeneratorModal({ weekState, onClose, onSyncWeekFromHistory }) {
  const [context, setContext]           = useState('')
  const [instructions, setInstructions]       = useState('')
  const [fileLoading, setFileLoading]         = useState(false)
  const [fileName, setFileName]               = useState('')
  const [existingBuffer, setExistingBuffer]   = useState(null) // buffer del .xlsx subido
  const [isExcelFile, setIsExcelFile]         = useState(false)
  const fileInputRef                          = useRef(null)
  const [status, setStatus]     = useState('idle')
  const [genStep, setGenStep]   = useState('')
  const [weekData, setWeekData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [editingJson, setEditingJson] = useState(false)
  const [previewTab, setPreviewTab]   = useState('resumen') // 'resumen' | 'wodbuster'
  const [wbCopied, setWbCopied]       = useState(false)
  const [rawJson, setRawJson]         = useState('')
  // Campos editables antes de descargar
  const [editTitle, setEditTitle]     = useState('')
  const [editSheetName, setEditSheetName] = useState(`S${weekState.week || 1}`)
  const [history, setHistory]         = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [publishing, setPublishing]   = useState(false)
  const [published, setPublished]     = useState(false)
  /** Texto de sesión alineado con el feedback (solo memoria del modal). */
  const sessionFingerprintsRef = useRef(new Map())
  const [staleFeedbackKeys, setStaleFeedbackKeys] = useState(() => new Set())
  const [regeneratingFeedbackKey, setRegeneratingFeedbackKey] = useState(null)

  // Cargar historial del mesociclo al abrir
  useEffect(() => {
    if (weekState.mesocycle) {
      setHistory(getHistoryForMesocycle(weekState.mesocycle))
    }
  }, [weekState.mesocycle])

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileLoading(true)
    setFileName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      const text = await extractTextFromFile(file)
      setContext(text)
      // Si es Excel, guardar el buffer para añadir pestaña después
      if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer()
        setExistingBuffer(buf)
        setIsExcelFile(true)
      } else {
        setExistingBuffer(null)
        setIsExcelFile(false)
      }
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    } finally {
      setFileLoading(false)
      e.target.value = ''
    }
  }

  /**
   * Una llamada API = un POST. Una semana completa usa callApi dos veces (L–Mi y J–Sa).
   * Modelo: sonnet (`AI_CONFIG.model`), max_tokens: `AI_CONFIG.maxTokens`.
   */
  async function callApi(userMessage, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const body = {
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        system: SYSTEM_PROMPT_EXCEL,
        messages: [{ role: 'user', content: userMessage }],
      }
      console.log('API Request (Proxy):', { model: body.model, attempt })

      // Modelo: sonnet — generación JSON semanal (SYSTEM_PROMPT_EXCEL); núcleo del producto.
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.status === 529 || response.status === 503 || response.status === 429) {
        if (attempt < retries) {
          const wait = (attempt + 1) * 10 // 10s, 20s, 30s
          setGenStep(`API saturada — reintentando en ${wait}s...`)
          await new Promise((r) => setTimeout(r, wait * 1000))
          continue
        }
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        console.error('API Error Response:', err)
        throw new Error(err?.error?.message || `Error ${response.status}`)
      }

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('La respuesta no contiene JSON válido')
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('API saturada después de varios intentos. Inténtalo de nuevo en unos minutos.')
  }

  async function handleGenerate() {
    if (!weekState.mesocycle) {
      setErrorMsg('Primero selecciona el tipo de Mesociclo y la Semana en el panel de la izquierda (aparece como "Configuración pendiente").')
      setStatus('error')
      return
    }

    setStatus('generating')
    setErrorMsg('')

    const mesoInfo = weekState.mesocycle
      ? `Mesociclo: ${weekState.mesocycle} | Semana: ${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` | Fase: ${weekState.phase}` : ''}`
      : 'Mesociclo no configurado'

    const historyContext = formatHistoryAsContext(history)
    const methodText = getMethodText()
    const baseContext = [
      mesoInfo,
      methodText ? `MÉTODO Y REGLAS PERMANENTES DE EVO:\n${methodText}` : '',
      historyContext ? `HISTORIAL DE SEMANAS ANTERIORES (mismo mesociclo):\n${historyContext}` : '',
      context ? `CONTEXTO ADICIONAL SUBIDO:\n${context}` : '',
      instructions ? `INSTRUCCIONES ESPECÍFICAS PARA ESTA SEMANA:\n${instructions}` : '',
    ].filter(Boolean).join('\n\n')

    try {
      // — Parte 1: Lunes, Martes, Miércoles —
      setGenStep('Generando Lunes · Martes · Miércoles...')
      const part1 = await callApi(
        `${baseContext}\n\nGenera SOLO los días LUNES, MARTES y MIÉRCOLES en formato JSON. Los días de la semana son: LUNES, MARTES, MIÉRCOLES, JUEVES, VIERNES, SÁBADO.`
      )

      // — Parte 2: Jueves, Viernes, Sábado —
      setGenStep('Generando Jueves · Viernes · Sábado...')
      const part2 = await callApi(
        `${baseContext}\n\nYA HAS GENERADO LOS PRIMEROS 3 DÍAS:\n${JSON.stringify(part1, null, 2)}\n\nAhora genera SOLO los días JUEVES, VIERNES y SÁBADO en formato JSON, manteniendo una coherencia muscular estricta con los primeros tres días y respetando la distribución semanal de EVO.`
      )

      // — Combinar —
      const combined = {
        titulo: part1.titulo || `S${weekState.week} – MESOCICLO ${(weekState.mesocycle || '').toUpperCase()}`,
        semana: weekState.week,
        mesociclo: weekState.mesocycle,
        dias: [
          ...(part1.dias || []),
          ...(part2.dias || []),
        ],
      }

      sessionFingerprintsRef.current = buildSessionFingerprintMap(combined)
      setStaleFeedbackKeys(new Set())
      setWeekData(combined)
      setRawJson(JSON.stringify(combined, null, 2))
      setEditTitle(combined.titulo || '')
      setEditSheetName(`S${weekState.week || 1}`)
      setGenStep('')
      setStatus('previewing')
    } catch (err) {
      setErrorMsg(err.message)
      setGenStep('')
      setStatus('error')
    }
  }

  async function handlePublish() {
    try {
      setPublishing(true)
      let data = editingJson ? JSON.parse(rawJson) : { ...weekData }
      data.titulo = editTitle || data.titulo
      await publishWeek(data, weekState.mesocycle, weekState.week)
      setPublished(true)
    } catch (err) {
      setErrorMsg('Error publicando: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  function updateWeekData(updater) {
    setWeekData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setRawJson(JSON.stringify(next, null, 2))
      return next
    })
  }

  function handleSessionFieldChange(diaIdx, sessionKey, feedbackKey, newText) {
    updateWeekData((prev) => {
      const dias = [...(prev.dias || [])]
      dias[diaIdx] = { ...dias[diaIdx], [sessionKey]: newText }
      return { ...prev, dias }
    })
    const aligned = sessionFingerprintsRef.current.get(sessionFingerprintKey(diaIdx, sessionKey)) ?? ''
    setStaleFeedbackKeys((prev) => {
      const next = new Set(prev)
      const sk = feedbackStaleKey(diaIdx, feedbackKey)
      if (newText !== aligned) next.add(sk)
      else next.delete(sk)
      return next
    })
  }

  function handleFeedbackFieldChange(diaIdx, sessionKey, feedbackKey, newText) {
    updateWeekData((prev) => {
      const dias = [...(prev.dias || [])]
      const prevDia = dias[diaIdx] || {}
      const sessionSnapshot = prevDia[sessionKey] ?? ''
      sessionFingerprintsRef.current.set(sessionFingerprintKey(diaIdx, sessionKey), sessionSnapshot)
      dias[diaIdx] = { ...prevDia, [feedbackKey]: newText }
      return { ...prev, dias }
    })
    setStaleFeedbackKeys((prev) => {
      const next = new Set(prev)
      next.delete(feedbackStaleKey(diaIdx, feedbackKey))
      return next
    })
  }

  async function regenerateFeedbackForClass(
    diaIdx,
    sessionKey,
    feedbackKey,
    dayName,
    classLabel,
    sessionText,
  ) {
    const sk = feedbackStaleKey(diaIdx, feedbackKey)
    setRegeneratingFeedbackKey(sk)
    setErrorMsg('')
    try {
      const userMsg = [
        `La clase es: ${classLabel}. Usa en la salida los tres prefijos que corresponden a esta clase según las instrucciones del sistema.`,
        '',
        `Día: ${dayName || '—'}`,
        '',
        'SESIÓN COMPLETA DE LA CLASE:',
        sessionText || '(vacía)',
      ].join('\n')

      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AI_CONFIG.supportModel,
          max_tokens: AI_CONFIG.feedbackRegenerateMaxTokens,
          system: SYSTEM_PROMPT_REGENERATE_FEEDBACK,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message || `Error ${response.status}`)
      }

      const data = await response.json()
      const raw = data.content?.[0]?.text || ''
      const feedback = stripCodeFences(raw)
      if (!feedback.trim()) throw new Error('La API no devolvió texto de feedback.')

      updateWeekData((prev) => {
        const dias = [...(prev.dias || [])]
        dias[diaIdx] = { ...dias[diaIdx], [feedbackKey]: feedback }
        return { ...prev, dias }
      })
      sessionFingerprintsRef.current.set(sessionFingerprintKey(diaIdx, sessionKey), sessionText ?? '')
      setStaleFeedbackKeys((prev) => {
        const next = new Set(prev)
        next.delete(sk)
        return next
      })
    } catch (err) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo regenerar el feedback.')
    } finally {
      setRegeneratingFeedbackKey(null)
    }
  }

  function switchPreviewTab(id) {
    if (previewTab === 'json' && id !== 'json') {
      try {
        const parsed = JSON.parse(rawJson)
        if (!parsed || !Array.isArray(parsed.dias)) throw new Error('Falta el array "dias"')
        sessionFingerprintsRef.current = buildSessionFingerprintMap(parsed)
        setStaleFeedbackKeys(new Set())
        setWeekData(parsed)
        setRawJson(JSON.stringify(parsed, null, 2))
      } catch (e) {
        setErrorMsg(e.message || 'JSON no válido. Corrige la pestaña JSON antes de salir.')
        return
      }
    }
    setPreviewTab(id)
    setEditingJson(id === 'json')
    if (id !== 'json') setErrorMsg('')
  }

  function openHistoryEntryForEdit(entry) {
    if (!entry?.weekDataFull || !Array.isArray(entry.weekDataFull.dias)) {
      setErrorMsg(
        'Esta entrada del historial no guarda el JSON completo (es anterior a la actualización). Genera la semana de nuevo y descarga Excel una vez para guardar una copia editable.',
      )
      setStatus((s) => (s === 'previewing' ? 'previewing' : 'error'))
      return
    }
    setErrorMsg('')
    const data = JSON.parse(JSON.stringify(entry.weekDataFull))
    data.semana = entry.semana
    data.mesociclo = weekState.mesocycle || data.mesociclo
    sessionFingerprintsRef.current = buildSessionFingerprintMap(data)
    setStaleFeedbackKeys(new Set())
    setWeekData(data)
    setRawJson(JSON.stringify(data, null, 2))
    setEditTitle(data.titulo || entry.titulo || '')
    setEditSheetName(`S${entry.semana}`)
    setPublished(false)
    setPreviewTab('editar')
    setEditingJson(false)
    setStatus('previewing')
    onSyncWeekFromHistory?.(entry.semana)
  }

  async function handleDownload() {
    try {
      setStatus('downloading')
      let data = editingJson ? JSON.parse(rawJson) : { ...weekData }
      data.titulo = editTitle || data.titulo
      data.sheetName = editSheetName || `S${weekState.week || 1}`
      await generateWeekExcel(data, isExcelFile ? existingBuffer : null)
      // Guardar en historial automáticamente
      saveWeekToHistory(weekState.mesocycle, weekState.week, data)
      setHistory(getHistoryForMesocycle(weekState.mesocycle))
      setStatus('previewing')
    } catch (err) {
      setErrorMsg('Error generando Excel: ' + err.message)
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-white border border-black/5 rounded-3xl flex flex-col max-h-[90vh] animate-fade-in shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white shadow-sm">
          <div>
            <h2 className="text-display text-base font-bold text-evo-text uppercase tracking-tight">Generar Programación Semanal</h2>
            <p className="text-[10px] text-evo-muted font-bold mt-1 uppercase tracking-widest">
              {weekState.mesocycle
                ? `${weekState.mesocycle} · S${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` · ${weekState.phase}` : ''}`
                : 'Configuración pendiente'
              }
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-evo-muted hover:text-red-500 transition-all shadow-sm border border-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* IDLE / INPUT */}
          {(status === 'idle' || status === 'error') && (
            <>
              {/* Contexto histórico */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-evo-text uppercase tracking-wider">
                    Contexto de Programación Anterior
                  </label>
                  <div className="flex items-center gap-2">
                    {fileName && (
                      <span className="text-[10px] text-[#2FBE7B] flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {fileName}
                      </span>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fileLoading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-evo-accent/5 hover:bg-evo-accent/10 border border-evo-accent/10 text-evo-accent text-[10px] font-bold uppercase transition-all shadow-sm"
                    >
                      {fileLoading ? (
                        <>Leyendo...</>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          Subir archivo
                        </>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.docx,.doc,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-evo-muted mb-1 font-medium">Sube archivos (.docx, .xlsx, .txt) o pega la programación previa.</p>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Ej: Durante las últimas 3 semanas hemos trabajado fuerza máxima en sentadilla. Los alumnos están fatigados de tracción..."
                  rows={6}
                  className="w-full bg-gray-50/50 border border-black/5 rounded-2xl px-5 py-4 text-xs !text-[#1A0A1A] caret-[#1A0A1A] placeholder:!text-[#6B5A6B] placeholder:opacity-100 focus:outline-none focus:border-evo-accent/30 focus:bg-white transition-all font-mono leading-relaxed shadow-inner"
                />
              </div>

              {/* Instrucciones específicas */}
              <div className="space-y-3">
                <label className="block text-[11px] font-bold text-evo-text uppercase tracking-wider">
                  Instrucciones para esta Semana
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ej: Quiero que esta semana sea de descarga. El sábado hay evento especial de CrossFit..."
                  rows={3}
                  className="w-full bg-gray-50/50 border border-black/5 rounded-2xl px-5 py-4 text-xs !text-[#1A0A1A] caret-[#1A0A1A] placeholder:!text-[#6B5A6B] placeholder:opacity-100 focus:outline-none focus:border-evo-accent/30 focus:bg-white transition-all leading-relaxed shadow-inner"
                />
              </div>

              {errorMsg && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-800 font-medium">{errorMsg}</p>
                </div>
              )}

              {/* Historial del mesociclo */}
              {history.length > 0 && (
                <div className="border border-black/5 rounded-2xl overflow-hidden shadow-soft bg-white">
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/50 hover:bg-gray-100/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-evo-text uppercase tracking-widest">Historial del Mesociclo</span>
                      <span className="text-[9px] bg-evo-accent/10 text-evo-accent px-2 py-0.5 rounded-full font-bold">{history.length} SEMANAS</span>
                    </div>
                    <span className="text-evo-muted text-xs">{showHistory ? '▲' : '▼'}</span>
                  </button>
                  {showHistory && (
                    <div className="animate-fade-in">
                      <div className="divide-y divide-black/5">
                        {history.map((entry) => (
                          <div key={entry.semana} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-gray-50/30 transition-all">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-evo-text uppercase tracking-tight">Semana {entry.semana} — {entry.titulo || 'Sin título'}</p>
                              {entry.resumen && (
                                <p className="text-[9px] text-evo-muted font-medium mt-1">
                                  {entry.resumen.estimulo} · {entry.resumen.foco}
                                </p>
                              )}
                              <p className="text-[9px] text-gray-400 mt-1">
                                {new Date(entry.savedAt).toLocaleDateString()}
                                {!entry.weekDataFull && (
                                  <span className="block text-amber-700 font-bold mt-0.5">
                                    Sin JSON completo — no editable hasta volver a generar y exportar
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openHistoryEntryForEdit(entry)}
                                className="text-[9px] text-evo-accent font-bold uppercase hover:bg-evo-accent/10 px-2 py-1 rounded-lg transition-all border border-evo-accent/20"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteWeekFromHistory(weekState.mesocycle, entry.semana)
                                  setHistory(getHistoryForMesocycle(weekState.mesocycle))
                                }}
                                className="text-[9px] text-red-500 font-bold uppercase hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-bold bg-indigo-50/50 rounded-2xl px-5 py-4 border border-indigo-100/50 uppercase tracking-tight shadow-sm">
                <span className="text-sm">💡</span>
                <span>Generaremos Lunes→Sábado (Funcional + Basics + Fit). Tiempo estimado: 45s.</span>
              </div>
            </>
          )}

          {/* GENERATING */}
          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-evo-bg flex items-center justify-center shadow-elevated border border-black/5 animate-bounce">
                <span className="text-display text-4xl font-black text-evo-accent">E</span>
              </div>
              <div className="space-y-2">
                <p className="text-base font-bold text-evo-text text-center uppercase tracking-tight">
                  {genStep || 'Iniciando generación...'}
                </p>
                <p className="text-[11px] text-evo-muted text-center font-bold uppercase tracking-widest">Memoria AI activa · Coherencia EVO</p>
              </div>
              <div className="flex gap-2.5">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="w-2.5 h-2.5 rounded-full bg-evo-accent animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {status === 'previewing' && weekData && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-inner border border-black/5">
                  {[
                    { id: 'resumen', label: 'Resumen' },
                    { id: 'editar', label: 'Editar' },
                    { id: 'wodbuster', label: 'WodBuster' },
                    { id: 'json', label: 'JSON (avanzado)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => switchPreviewTab(tab.id)}
                      className={`text-[10px] px-3 py-1.5 rounded-lg transition-all font-bold uppercase tracking-tight ${
                        previewTab === tab.id
                          ? 'bg-white shadow-sm text-evo-accent'
                          : 'text-evo-muted hover:text-evo-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Listo para Exportar</p>
                </div>
              </div>

              {history.length > 0 && (
                <details className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-2">
                  <summary className="text-[10px] font-bold uppercase text-amber-950 cursor-pointer select-none">
                    Historial del mesociclo — cargar otra semana
                  </summary>
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-black/5 bg-white divide-y divide-black/5">
                    {history.map((entry) => (
                      <div key={`pv-${entry.semana}`} className="px-4 py-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-evo-text uppercase">S{entry.semana} — {entry.titulo || 'Sin título'}</p>
                          {!entry.weekDataFull && (
                            <p className="text-[9px] text-amber-800 font-medium mt-0.5">Sin JSON completo</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openHistoryEntryForEdit(entry)}
                            className="text-[9px] text-evo-accent font-bold uppercase hover:bg-evo-accent/10 px-2 py-1 rounded border border-evo-accent/20"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteWeekFromHistory(weekState.mesocycle, entry.semana)
                              setHistory(getHistoryForMesocycle(weekState.mesocycle))
                            }}
                            className="text-[9px] text-red-500 font-bold uppercase hover:bg-red-50 px-2 py-1 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Campos editables: título y pestaña */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-evo-muted font-bold uppercase tracking-widest mb-1.5 block ml-1">Título del Documento</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Ej: S4 – MESOCICLO FUERZA · 80-85%"
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-medium focus:outline-none focus:border-evo-accent shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-evo-muted font-bold uppercase tracking-widest mb-1.5 block ml-1">Pestaña</label>
                  <input
                    type="text"
                    value={editSheetName}
                    onChange={(e) => setEditSheetName(e.target.value)}
                    placeholder="S4"
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-medium focus:outline-none focus:border-evo-accent shadow-sm"
                  />
                </div>
              </div>

              {isExcelFile && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm">
                  <span className="text-emerald-500 text-xs">●</span>
                  <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-tight">
                    Excel Detectado: Se añadirá como pestaña <span className="text-emerald-900">"{editSheetName}"</span>
                  </p>
                </div>
              )}

              {/* Resumen de semana */}
              {weekData.resumen && previewTab === 'resumen' && (
                <div className="bg-evo-accent/5 border border-evo-accent/10 rounded-2xl p-5 space-y-3 shadow-soft">
                  <p className="text-[10px] font-bold text-evo-accent uppercase tracking-widest">Resumen de Orientación Semanal</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest">Estímulo</p>
                      <p className="text-[11px] text-evo-text font-semibold">{weekData.resumen.estimulo}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest">Intensidad · Foco</p>
                      <p className="text-[11px] text-evo-text font-semibold">{weekData.resumen.intensidad} · {weekData.resumen.foco}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest">Nota Metodológica</p>
                      <p className="text-[11px] text-evo-text font-semibold leading-relaxed">{weekData.resumen.nota}</p>
                    </div>
                  </div>
                </div>
              )}

              {previewTab === 'editar' && weekData && (
                <div className="space-y-5 max-h-[min(52vh,480px)] overflow-y-auto pr-1 custom-scrollbar border border-black/5 rounded-2xl p-4 bg-gray-50/30">
                  <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest leading-relaxed">
                    Cambia textos aquí; al publicar o descargar se usa esta versión. No hace falta tocar JSON salvo que quieras.
                  </p>

                  <div className="rounded-2xl border border-evo-accent/20 bg-white p-4 space-y-3 shadow-sm">
                    <p className="text-[10px] font-bold text-evo-accent uppercase tracking-widest">Orientación semanal</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { k: 'estimulo', label: 'Estímulo' },
                        { k: 'intensidad', label: 'Intensidad' },
                        { k: 'foco', label: 'Foco' },
                      ].map(({ k, label }) => (
                        <label key={k} className="block space-y-1">
                          <span className="text-[9px] font-bold text-evo-muted uppercase tracking-widest">{label}</span>
                          <input
                            type="text"
                            value={(weekData.resumen && weekData.resumen[k]) || ''}
                            onChange={(e) =>
                              updateWeekData((prev) => ({
                                ...prev,
                                resumen: { ...(prev.resumen || {}), [k]: e.target.value },
                              }))
                            }
                            className="w-full text-xs !text-[#1A0A1A] caret-[#1A0A1A] border border-black/10 rounded-xl px-3 py-2 focus:outline-none focus:border-evo-accent/40"
                          />
                        </label>
                      ))}
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold text-evo-muted uppercase tracking-widest">Nota metodológica</span>
                      <textarea
                        rows={3}
                        value={(weekData.resumen && weekData.resumen.nota) || ''}
                        onChange={(e) =>
                          updateWeekData((prev) => ({
                            ...prev,
                            resumen: { ...(prev.resumen || {}), nota: e.target.value },
                          }))
                        }
                        className="w-full text-xs !text-[#1A0A1A] caret-[#1A0A1A] border border-black/10 rounded-xl px-3 py-2 focus:outline-none focus:border-evo-accent/40 leading-relaxed"
                      />
                    </label>
                  </div>

                  {(weekData.dias || []).map((dia, diaIdx) => (
                    <div key={dia.nombre || diaIdx} className="rounded-2xl border border-black/8 bg-white p-4 space-y-4 shadow-sm">
                      <p className="text-[12px] font-bold text-evo-text uppercase tracking-wide border-b border-black/5 pb-2">
                        {dia.nombre || `Día ${diaIdx + 1}`}
                      </p>

                      {EDIT_SESSION_FIELDS.map(({ key, label, color, feedbackKey }) => (
                        <label key={key} className="block space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                            {label}
                          </span>
                          <textarea
                            rows={6}
                            value={dia[key] || ''}
                            onChange={(e) =>
                              handleSessionFieldChange(diaIdx, key, feedbackKey, e.target.value)
                            }
                            placeholder={`Texto de la sesión ${label}…`}
                            className="w-full text-[11px] font-mono !text-[#1A0A1A] caret-[#1A0A1A] border border-black/10 rounded-xl px-3 py-2 focus:outline-none focus:border-evo-accent/40 leading-relaxed"
                          />
                        </label>
                      ))}

                      <div className="pt-2 border-t border-dashed border-black/10 space-y-3">
                        <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest">Feedbacks (coaching)</p>
                        {EVO_SESSION_CLASS_DEFS.map(({ key: sessionKey, feedbackKey, label }) => {
                          const shortLabel = `Feedback · ${label.replace(/^Evo/, '')}`
                          const sk = feedbackStaleKey(diaIdx, feedbackKey)
                          const isStale = staleFeedbackKeys.has(sk)
                          const isBusy = regeneratingFeedbackKey === sk
                          return (
                            <div key={feedbackKey} className="block space-y-1.5">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span className="text-[9px] font-bold text-evo-muted uppercase tracking-widest">
                                  {shortLabel}
                                </span>
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  {isStale && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200/80">
                                      Desactualizado
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      regenerateFeedbackForClass(
                                        diaIdx,
                                        sessionKey,
                                        feedbackKey,
                                        dia.nombre,
                                        label,
                                        dia[sessionKey] || '',
                                      )
                                    }
                                    className="text-[9px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50 disabled:opacity-50 disabled:pointer-events-none"
                                  >
                                    {isBusy ? 'Regenerando…' : 'Regenerar feedback'}
                                  </button>
                                </div>
                              </div>
                              {isStale && (
                                <p className="text-[10px] text-amber-900/90 leading-snug bg-amber-50/80 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                  Sesión editada: el feedback puede no coincidir con el entrenamiento actual.
                                </p>
                              )}
                              <label className="block">
                                <textarea
                                  rows={3}
                                  value={dia[feedbackKey] || ''}
                                  onChange={(e) =>
                                    handleFeedbackFieldChange(
                                      diaIdx,
                                      sessionKey,
                                      feedbackKey,
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Objetivo / Escalado / Coaching WOD…"
                                  className="w-full text-[11px] !text-[#1A0A1A] caret-[#1A0A1A] border border-indigo-100 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-300 leading-relaxed bg-indigo-50/20"
                                />
                              </label>
                            </div>
                          )
                        })}
                      </div>

                      <label className="block space-y-1.5 pt-2 border-t border-black/5">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">WodBuster (vista alumno)</span>
                        <textarea
                          rows={5}
                          value={dia.wodbuster || ''}
                          onChange={(e) =>
                            updateWeekData((prev) => {
                              const dias = [...(prev.dias || [])]
                              dias[diaIdx] = { ...dias[diaIdx], wodbuster: e.target.value }
                              return { ...prev, dias }
                            })
                          }
                          className="w-full text-[11px] !text-[#1A0A1A] caret-[#1A0A1A] border border-emerald-100 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-300 leading-relaxed bg-emerald-50/15"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {previewTab === 'wodbuster' && (() => {
                const wbText = (weekData.dias || [])
                  .map((d) => d.wodbuster || '')
                  .filter(Boolean)
                  .join('\n\n─────────────────────\n\n')

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest">Vista Alumno (WodBuster)</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wbText)
                          setWbCopied(true)
                          setTimeout(() => setWbCopied(false), 2000)
                        }}
                        className={`text-[10px] px-4 py-1.5 rounded-xl transition-all shadow-sm font-bold uppercase ${
                          wbCopied
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                            : 'bg-white border border-black/10 text-evo-text hover:bg-gray-50'
                        }`}
                      >
                        {wbCopied ? '✓ Copiado' : 'Copiar Todo'}
                      </button>
                    </div>
                    <pre className="w-full bg-gray-50 border border-black/5 rounded-2xl px-5 py-5 text-[11px] text-evo-text font-medium leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto font-sans shadow-inner">
                      {wbText || 'Sin datos WodBuster — regenera la semana para obtener esta versión'}
                    </pre>
                  </div>
                )
              })()}

              {previewTab === 'json' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-amber-800/90 font-bold uppercase tracking-widest bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    Solo para usuarios avanzados. Si algo falla, vuelve a «Editar» o regenera la semana.
                  </p>
                  <textarea
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                    rows={16}
                    className="evo-json-console w-full bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 text-[10px] text-emerald-400 font-mono focus:outline-none leading-relaxed shadow-2xl"
                    spellCheck={false}
                  />
                </div>
              )}

              {previewTab === 'resumen' && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {weekData.dias?.map((dia) => {
                    const ALL = [
                      { key: 'evofuncional', label: 'Funcional', color: '#2F7BBE' },
                      { key: 'evobasics', label: 'Basics', color: '#E07B39' },
                      { key: 'evofit', label: 'Fit', color: '#2FBE7B' },
                      { key: 'evohybrix', label: 'Hybrix', color: '#BE2F2F' },
                      { key: 'evofuerza', label: 'Fuerza', color: '#BE2F2F' },
                      { key: 'evogimnastica', label: 'Gimnástica', color: '#D93F8E' },
                      { key: 'evotodos', label: 'EvoTodos', color: '#A729AD' },
                    ]
                    const active = ALL.filter((c) => dia[c.key])
                    return (
                      <div key={dia.nombre} className="bg-white rounded-2xl p-4 border border-black/5 shadow-soft">
                        <p className="text-[11px] font-bold text-evo-text uppercase tracking-widest mb-3 ml-1">{dia.nombre}</p>
                        <div className={`grid gap-2 ${active.length <= 3 ? 'grid-cols-3' : 'grid-cols-3'}`}>
                          {active.map(({ key, label, color }) => (
                            <div key={key} className="relative rounded-lg p-2 group/class" style={{ backgroundColor: `${color}11`, border: `1px solid ${color}33` }}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[9px] font-medium" style={{ color }}>{label}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(dia[key])
                                    const btn = e.currentTarget
                                    const oldHtml = btn.innerHTML
                                    btn.innerHTML = '✓'
                                    setTimeout(() => btn.innerHTML = oldHtml, 2000)
                                  }}
                                  className="opacity-0 group-hover/class:opacity-100 transition-opacity text-[8px] bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded border border-white/10 text-evo-muted hover:text-white"
                                  title={`Copiar sesión de ${label}`}
                                >
                                  Copiar
                                </button>
                              </div>
                              <p className="text-[9px] text-evo-muted leading-relaxed line-clamp-4" style={{ whiteSpace: 'pre-line' }}>
                                {dia[key]?.slice(0, 200) || '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {errorMsg && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-800 font-medium">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* DOWNLOADING */}
          {status === 'downloading' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <p className="text-sm text-evo-text font-medium">Generando archivo Excel...</p>
              <div className="flex gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-[#2FBE7B] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between flex-shrink-0 bg-gray-50/50 backdrop-blur-md">
          <button onClick={onClose} className="text-[10px] text-evo-muted font-bold uppercase tracking-widest hover:text-evo-text transition-all">
            Cancelar
          </button>
          <div className="flex gap-3">
            {status === 'previewing' && (
              <button
                onClick={handleGenerate}
                className="px-5 py-2.5 rounded-xl border border-black/10 bg-white text-evo-muted hover:text-evo-text hover:bg-gray-50 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Regenerar
              </button>
            )}
            {(status === 'idle' || status === 'error') && (
              <button
                onClick={handleGenerate}
                className="px-8 py-3 rounded-xl bg-evo-accent hover:bg-evo-accent-hover text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95"
              >
                Empezar Generación
              </button>
            )}
            {status === 'previewing' && (
              <>
                <button
                  onClick={handlePublish}
                  disabled={publishing || published}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-evo-accent/20 bg-evo-accent/5 hover:bg-evo-accent/10 disabled:opacity-50 text-evo-accent text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                >
                  {published ? '✓ Publicado' : publishing ? 'Publicando...' : 'Publicar Hub'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Descargar Excel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
