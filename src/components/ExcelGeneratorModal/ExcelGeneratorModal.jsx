import { useState, useRef, useEffect } from 'react'
import ExcelJS from 'exceljs'
import mammoth from 'mammoth'
import { SYSTEM_PROMPT_EXCEL } from '../../constants/systemPromptExcel.js'
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

export default function ExcelGeneratorModal({ weekState, onClose }) {
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

  async function callApi(userMessage, retries = 3) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          system: SYSTEM_PROMPT_EXCEL,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })

      if (response.status === 529 || response.status === 503 || response.status === 429) {
        if (attempt < retries) {
          const wait = (attempt + 1) * 10 // 10s, 20s, 30s
          setGenStep(`API saturada — reintentando en ${wait}s (intento ${attempt + 2}/${retries + 1})...`)
          await new Promise((r) => setTimeout(r, wait * 1000))
          continue
        }
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
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
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setErrorMsg('Falta la API key de Anthropic en el archivo .env')
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
        `${baseContext}\n\nYa tienes programados LUNES, MARTES y MIÉRCOLES. Genera SOLO los días JUEVES, VIERNES y SÁBADO en formato JSON, manteniendo coherencia muscular con los primeros tres días.`
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-[#111] border border-white/8 rounded-2xl flex flex-col max-h-[90vh] animate-fade-in">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-display text-sm font-bold text-white">Generar semana completa → Excel</h2>
            <p className="text-[10px] text-evo-muted mt-0.5">
              {weekState.mesocycle
                ? `${weekState.mesocycle} · S${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` · ${weekState.phase}` : ''}`
                : 'Configura primero el mesociclo en el panel izquierdo'
              }
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-evo-muted hover:text-white transition-colors">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* IDLE / INPUT */}
          {(status === 'idle' || status === 'error') && (
            <>
              {/* Contexto histórico */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-white">
                    Contexto de semanas anteriores
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7B2FBE]/20 hover:bg-[#7B2FBE]/30 border border-[#7B2FBE]/30 text-[#9B4FDE] text-[10px] font-medium transition-colors disabled:opacity-50"
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
                <p className="text-[10px] text-evo-muted mb-1.5">Sube un archivo .docx, .xlsx o .txt — o pega el texto directamente</p>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Sube un archivo o pega aquí la programación de las semanas anteriores del mesociclo. El agente la usará como referencia para mantener coherencia y progresión..."
                  rows={6}
                  className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-3 text-xs text-gray-300 placeholder-evo-muted focus:outline-none focus:border-[#7B2FBE]/40 font-mono leading-relaxed"
                />
              </div>

              {/* Instrucciones específicas */}
              <div>
                <label className="block text-xs font-medium text-white mb-1.5">
                  Instrucciones específicas para esta semana
                  <span className="text-evo-muted font-normal ml-1">(opcional)</span>
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ej: Esta semana quiero hacer hincapié en la sentadilla trasera. El lunes y miércoles hay competición de box, así que el jueves y viernes tienen que ser más suaves..."
                  rows={3}
                  className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-3 text-xs text-gray-300 placeholder-evo-muted focus:outline-none focus:border-[#7B2FBE]/40 leading-relaxed"
                />
              </div>

              {errorMsg && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-400">{errorMsg}</p>
                </div>
              )}

              {/* Historial del mesociclo */}
              {history.length > 0 && (
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#222] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">Historial del mesociclo</span>
                      <span className="text-[9px] bg-[#7B2FBE]/30 text-[#A855F7] px-1.5 py-0.5 rounded-full">{history.length} semana{history.length > 1 ? 's' : ''} guardada{history.length > 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-evo-muted text-xs">{showHistory ? '▲' : '▼'}</span>
                  </button>
                  {showHistory && (
                    <div>
                      <div className="divide-y divide-white/5">
                        {history.map((entry) => (
                          <div key={entry.semana} className="px-4 py-2.5 bg-[#111] flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-medium text-white">S{entry.semana} — {entry.titulo || ''}</p>
                              {entry.resumen && (
                                <p className="text-[9px] text-evo-muted mt-0.5">
                                  {entry.resumen.estimulo} · {entry.resumen.foco}
                                </p>
                              )}
                              <p className="text-[9px] text-white/20 mt-0.5">
                                Guardada {new Date(entry.savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                deleteWeekFromHistory(weekState.mesocycle, entry.semana)
                                setHistory(getHistoryForMesocycle(weekState.mesocycle))
                              }}
                              className="text-[9px] text-red-400/40 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5 px-2 py-1 rounded hover:bg-red-400/10"
                              title="Quitar esta semana del historial"
                            >
                              ✕ quitar
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2 bg-[#0D0D0D] flex justify-end">
                        <button
                          onClick={() => {
                            clearHistoryForMesocycle(weekState.mesocycle)
                            setHistory([])
                            setShowHistory(false)
                          }}
                          className="text-[9px] text-red-400/40 hover:text-red-400 transition-colors"
                        >
                          Borrar historial completo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-evo-muted bg-[#1A1A1A] rounded-xl px-4 py-3 border border-white/5">
                <span>💡</span>
                <span>El agente generará los 6 días completos (Lunes→Sábado) con EvoFuncional, EvoBasics y EvoFit. Puede tardar ~30 segundos.</span>
              </div>
            </>
          )}

          {/* GENERATING */}
          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 rounded-xl gradient-evo flex items-center justify-center shadow-lg shadow-[#7B2FBE]/20">
                <span className="text-display text-lg font-bold text-white">E</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white text-center">
                  {genStep || 'Preparando generación...'}
                </p>
                <p className="text-xs text-evo-muted text-center mt-1">2 llamadas · 3 días cada una · ~45 segundos en total</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-[#7B2FBE] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {status === 'previewing' && weekData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[
                    { id: 'resumen',   label: 'Resumen' },
                    { id: 'wodbuster', label: 'WodBuster' },
                    { id: 'json',      label: 'JSON' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setPreviewTab(tab.id); setEditingJson(tab.id === 'json') }}
                      className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                        previewTab === tab.id
                          ? 'bg-white/10 border-white/20 text-white'
                          : 'border-white/10 text-evo-muted hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-medium text-white">✓ Semana generada</p>
              </div>

              {/* Campos editables: título y pestaña */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] text-evo-muted mb-1 block">Título del Excel (editable)</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Ej: S4 – MESOCICLO FUERZA · 80-85% · Del 6 al 11 de abril 2026"
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7B2FBE]/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-evo-muted mb-1 block">Nombre pestaña</label>
                  <input
                    type="text"
                    value={editSheetName}
                    onChange={(e) => setEditSheetName(e.target.value)}
                    placeholder="S4"
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7B2FBE]/50"
                  />
                </div>
              </div>

              {isExcelFile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#2FBE7B]/10 border border-[#2FBE7B]/20 rounded-lg">
                  <span className="text-[#2FBE7B] text-xs">●</span>
                  <p className="text-[10px] text-[#2FBE7B]">
                    Se añadirá como pestaña <strong>"{editSheetName}"</strong> en <strong>{fileName}</strong>
                  </p>
                </div>
              )}

              {/* Resumen de semana */}
              {weekData.resumen && !editingJson && (
                <div className="bg-[#7B2FBE]/10 border border-[#7B2FBE]/25 rounded-xl p-3 space-y-1.5">
                  <p className="text-[9px] font-bold text-[#A855F7] uppercase tracking-wider">Resumen de semana</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] text-[#A855F7] font-medium">Estímulo</p>
                      <p className="text-[9px] text-white">{weekData.resumen.estimulo}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#A855F7] font-medium">Intensidad · Foco</p>
                      <p className="text-[9px] text-white">{weekData.resumen.intensidad} · {weekData.resumen.foco}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#A855F7] font-medium">Nota coach</p>
                      <p className="text-[9px] text-white">{weekData.resumen.nota}</p>
                    </div>
                  </div>
                </div>
              )}

              {previewTab === 'wodbuster' && (() => {
                const wbText = (weekData.dias || [])
                  .map((d) => d.wodbuster || '')
                  .filter(Boolean)
                  .join('\n\n─────────────────────\n\n')

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-evo-muted">Versión para alumnos — copia y pega en WodBuster</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wbText)
                          setWbCopied(true)
                          setTimeout(() => setWbCopied(false), 2000)
                        }}
                        className={`text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${
                          wbCopied
                            ? 'bg-[#2FBE7B]/20 border-[#2FBE7B]/30 text-[#2FBE7B]'
                            : 'border-white/10 text-evo-muted hover:text-white'
                        }`}
                      >
                        {wbCopied ? '✓ Copiado' : 'Copiar todo'}
                      </button>
                    </div>
                    <pre className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-3 text-[10px] text-gray-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto font-sans">
                      {wbText || 'Sin datos WodBuster — regenera la semana para obtener esta versión'}
                    </pre>
                  </div>
                )
              })()}

              {previewTab === 'json' && (
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={18}
                  className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-3 text-[10px] text-gray-300 font-mono focus:outline-none focus:border-[#7B2FBE]/40 leading-relaxed"
                  spellCheck={false}
                />
              )}

              {previewTab === 'resumen' && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {weekData.dias?.map((dia) => {
                    const ALL = [
                      { key: 'evofuncional', label: 'EvoFuncional', color: '#2F7BBE' },
                      { key: 'evobasics',    label: 'EvoBasics',    color: '#E07B39' },
                      { key: 'evofit',       label: 'EvoFit',       color: '#2FBE7B' },
                      { key: 'evohybrix',    label: 'EvoHybrix',    color: '#BE2F2F' },
                      { key: 'evofuerza',    label: 'EvoFuerza',    color: '#78350F' },
                      { key: 'evogimnastica',label: 'EvoGimnástica',color: '#4C1D95' },
                    ]
                    const active = ALL.filter((c) => dia[c.key])
                    return (
                      <div key={dia.nombre} className="bg-[#1A1A1A] rounded-xl p-3 border border-white/5">
                        <p className="text-xs font-semibold text-white mb-2">{dia.nombre}</p>
                        <div className={`grid gap-2 ${active.length <= 3 ? 'grid-cols-3' : 'grid-cols-3'}`}>
                          {active.map(({ key, label, color }) => (
                            <div key={key} className="rounded-lg p-2" style={{ backgroundColor: `${color}11`, border: `1px solid ${color}33` }}>
                              <p className="text-[9px] font-medium mb-1" style={{ color }}>{label}</p>
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
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-400">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* DOWNLOADING */}
          {status === 'downloading' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <p className="text-sm text-white">Generando archivo Excel...</p>
              <div className="flex gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-[#2FBE7B] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="text-xs text-evo-muted hover:text-white transition-colors">
            Cerrar
          </button>
          <div className="flex gap-2">
            {status === 'previewing' && (
              <button
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg border border-white/10 text-evo-muted hover:text-white text-xs transition-colors"
              >
                Regenerar
              </button>
            )}
            {(status === 'idle' || status === 'error') && (
              <button
                onClick={handleGenerate}
                disabled={!weekState.mesocycle}
                className="px-5 py-2 rounded-lg bg-[#7B2FBE] hover:bg-[#9B4FDE] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
              >
                Generar semana
              </button>
            )}
            {status === 'previewing' && (
              <>
                <button
                  onClick={handlePublish}
                  disabled={publishing || published}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#7B2FBE]/40 bg-[#7B2FBE]/10 hover:bg-[#7B2FBE]/20 disabled:opacity-50 text-[#A855F7] text-xs font-medium transition-colors"
                >
                  {published ? '✓ Publicada para entrenadores' : publishing ? 'Publicando...' : '↑ Publicar para entrenadores'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2FBE7B] hover:bg-[#3FDE9B] text-white text-xs font-medium transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
