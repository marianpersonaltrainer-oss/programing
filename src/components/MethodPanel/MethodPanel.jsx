import { useState, useEffect, useRef } from 'react'
import {
  loadLearnedState,
  saveLearnedState,
  getLearnedRulesConcatenated,
  removeAutoLearnedEntry,
  clearAutoLearnedEntries,
  clearAllLearned,
} from '../../utils/methodLearnedStorage.js'
import {
  loadReferenceMesocycleContextRaw,
  saveReferenceMesocycleContextRaw,
} from '../../utils/referenceMesocycleContextStorage.js'
import { extractDriveFolderId } from '../../utils/driveFolderId.js'

const DRIVE_FOLDER_LS_KEY = 'programingevo_drive_programming_folder_id'
const COACH_ADMIN_SECRET_SESSION_KEY = 'evo_coach_guide_admin_secret'

const METHOD_KEY = 'programingevo_method'

export const DEFAULT_METHOD = `FILOSOFÍA EVO
EVO es un centro funcional con formato CrossFit pero con identidad propia. Adulto activo 28-55 años. Abierto a ejercicios nuevos, accesorios y creatividad.

CLASES ACTIVAS
EvoFuncional: fuerza + habilidad + WOD intenso
EvoBasics: técnica y progresión, juego siempre en calentamiento
EvoFit: fuerza moderada, sin técnica compleja, nadie sale destrozado
EvoHybrix: metabólica por bloques, equipos/parejas, máquinas + cardio
(EvoFuerza, EvoGimnástica y EvoTodos: solo cuando se especifique en instrucciones)

REGLAS FIJAS
- No muscle ups, no deficit HSPU, no rope climb, no pegboard
- No overhead squat como ejercicio principal
- Thruster máx 1 vez/semana total
- Mismo squat con barra: máx 1 vez/semana por clase
- Landmine obligatorio 1 vez/semana en cada clase
- No mismo ejercicio principal en Funcional y Basics el mismo día

ESTILO DE PROGRAMACIÓN
- Clases distintas, no versiones escaladas de la misma sesión
- Feedback al coach: briefing texto corrido (ver prompt Excel), sin apartados formales
- Timings: NOMBRE DEL BLOQUE (X' - Y') — ver SYSTEM_PROMPT_EXCEL
- EvoFit: nunca KB Clean, Power Clean, Snatch ni movimientos olímpicos`

export const DEFAULT_LEARNED_PLACEHOLDER = `Anota aquí correcciones tras revisar semanas, frases que funcionaron en sala, errores a no repetir, ejemplos reales de cómo explicar un formato, etc.

(Las entradas automáticas al editar sesiones aparecen debajo con fecha; aquí va tu texto libre.)`

export const DEFAULT_REFERENCE_MESOCYCLES_PLACEHOLDER = `Opcional: pega aquí extractos o resúmenes de semanas que ya programaste (otro mesociclo, Drive, notas). No hace falta la semana entera: bloques que os fueron bien, decisiones de timing/descansos, o “en fuerza evitamos X”.

La IA lo usa como referencia de estilo y ritmo en sala — no para copiar sesiones literales. Si lo dejas vacío, no se envía nada extra.`

export function getLearnedRulesText() {
  return getLearnedRulesConcatenated()
}

/** Texto completo para APIs: método base + reglas aprendidas (si hay). */
export function getMethodText() {
  let base
  try {
    const saved = localStorage.getItem(METHOD_KEY)
    base = saved || DEFAULT_METHOD
  } catch {
    base = DEFAULT_METHOD
  }
  const learned = getLearnedRulesConcatenated().trim()
  if (!learned) return base
  return `${base}\n\n════════════════════════════════════════\nREGLAS APRENDIDAS\n════════════════════════════════════════\n\n${learned}`
}

export function saveMethodText(baseText) {
  try {
    localStorage.setItem(METHOD_KEY, baseText)
  } catch {
    // ignore
  }
}

/** Sustituye solo el bloque manual; preserva entradas automáticas. */
export function saveLearnedRulesText(text) {
  const state = loadLearnedState()
  state.manual = text
  saveLearnedState(state)
}

function formatAutoDate(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

export default function MethodPanel({ onClose }) {
  const driveSectionRef = useRef(null)
  const [baseText, setBaseText] = useState('')
  const [learnedManual, setLearnedManual] = useState('')
  const [referenceMesocycles, setReferenceMesocycles] = useState('')
  const [driveFolderInput, setDriveFolderInput] = useState('')
  const [driveAdminSecret, setDriveAdminSecret] = useState('')
  const [driveImportBusy, setDriveImportBusy] = useState(false)
  const [driveImportMsg, setDriveImportMsg] = useState('')
  const [autoEntries, setAutoEntries] = useState([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const b = localStorage.getItem(METHOD_KEY)
      setBaseText(b || DEFAULT_METHOD)
    } catch {
      setBaseText(DEFAULT_METHOD)
    }
    const s = loadLearnedState()
    setLearnedManual(s.manual)
    setAutoEntries(s.auto)
    setReferenceMesocycles(loadReferenceMesocycleContextRaw())
    try {
      setDriveFolderInput(localStorage.getItem(DRIVE_FOLDER_LS_KEY) || '')
    } catch {
      setDriveFolderInput('')
    }
    try {
      setDriveAdminSecret(sessionStorage.getItem(COACH_ADMIN_SECRET_SESSION_KEY) || '')
    } catch {
      setDriveAdminSecret('')
    }
  }, [])

  function handleSave() {
    saveMethodText(baseText)
    saveLearnedState({ manual: learnedManual, auto: autoEntries })
    saveReferenceMesocycleContextRaw(referenceMesocycles)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    if (window.confirm('¿Restaurar el método base a los valores EVO por defecto? No borra las Reglas aprendidas.')) {
      setBaseText(DEFAULT_METHOD)
      saveMethodText(DEFAULT_METHOD)
    }
  }

  function handleClearLearned() {
    if (window.confirm('¿Vaciar manual y todas las reglas automáticas?')) {
      clearAllLearned()
      setLearnedManual('')
      setAutoEntries([])
    }
  }

  function handleClearAutoOnly() {
    if (window.confirm('¿Vaciar solo las sugerencias automáticas (ediciones de sesión)?')) {
      clearAutoLearnedEntries()
      setAutoEntries([])
    }
  }

  function handleRemoveAuto(id) {
    removeAutoLearnedEntry(id)
    setAutoEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleDriveImport() {
    setDriveImportMsg('')
    const secret = driveAdminSecret.trim()
    if (!secret) {
      setDriveImportMsg('Introduce la clave de administración (la misma que COACH_GUIDE_ADMIN_SECRET en Vercel).')
      return
    }
    const folderId = extractDriveFolderId(driveFolderInput)
    setDriveImportBusy(true)
    try {
      const res = await fetch('/api/programming-drive-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, folderId: folderId || undefined, folderName: 'programacion' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDriveImportMsg(String(json.error || json.detail || `Error ${res.status}`))
        return
      }
      try {
        sessionStorage.setItem(COACH_ADMIN_SECRET_SESSION_KEY, secret)
      } catch {
        /* ignore */
      }
      if (driveFolderInput.trim()) {
        try {
          localStorage.setItem(DRIVE_FOLDER_LS_KEY, driveFolderInput.trim())
        } catch {
          /* ignore */
        }
      }
      const imported = String(json.text || '').trim()
      const meta = json.meta || {}
      if (!imported) {
        setDriveImportMsg(meta.hint || 'La carpeta no devolvió texto exportable (revisa tipos de archivo).')
        return
      }
      const stamp = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
      const banner = `--- Importación Google Drive (${stamp}) · ${meta.exported || 0} archivo(s) ---`
      setReferenceMesocycles((prev) => {
        const base = String(prev || '').trim()
        const next = base ? `${base}\n\n${banner}\n${imported}` : `${banner}\n${imported}`
        return next
      })
      const folderMsg = meta.folderNameMatched
        ? ` Carpeta detectada automáticamente: ${meta.folderNameMatched}.`
        : ''
      setDriveImportMsg(
        `Listo: se añadieron ~${imported.length} caracteres (${meta.exported || 0} archivos).${folderMsg} Pulsa «Guardar cambios» para persistir.`,
      )
    } catch (e) {
      setDriveImportMsg(e?.message || 'No se pudo conectar con el servidor (¿estás en Vercel o `vercel dev`?).')
    } finally {
      setDriveImportBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl bg-white border border-black/5 rounded-3xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-fade-in text-[#1A0A1A]"
        style={{ color: '#000', WebkitTextFillColor: '#000' }}
      >
        <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white">
          <div>
            <h2 className="text-display text-base font-extrabold !text-black uppercase tracking-tight" style={{ color: '#000' }}>Tu Método EVO</h2>
            <p className="text-[11px] !text-black font-bold mt-1 uppercase tracking-wide" style={{ color: '#000' }}>
              REGLAS FIJAS · REGLAS APRENDIDAS · DOCUMENTO VIVO
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-neutral-700 hover:text-red-600 transition-all shadow-sm border border-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-8 pt-4 flex-shrink-0 space-y-3">
          <div className="flex items-start gap-3 px-4 py-3 bg-evo-accent/5 border border-evo-accent/10 rounded-2xl shadow-sm">
            <span className="text-[#1A0A1A] text-lg flex-shrink-0 mt--0.5">✦</span>
            <p className="text-[11px] !text-black font-medium leading-relaxed" style={{ color: '#000' }}>
              <span className="font-bold !text-black">Método base</span>,{' '}
              <span className="font-bold !text-black">Reglas aprendidas</span> y, si lo rellenas,{' '}
              <span className="font-bold !text-black">Contexto de otros mesociclos</span> se envían al generar Excel, al editar un día con IA y al agente del panel (con límites de tamaño en el bloque opcional). La importación desde Drive añade texto aquí; sigue haciendo falta configurar Vercel y compartir la carpeta con la cuenta de servicio.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => driveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Ir a conectar carpeta Drive
            </button>
          </div>
        </div>

        <div className="flex-1 px-8 py-4 min-h-0 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold !text-black uppercase tracking-wide" style={{ color: '#000' }}>Método base</label>
            <textarea
              value={baseText}
              onChange={(e) => {
                setBaseText(e.target.value)
                setSaved(false)
              }}
              spellCheck={false}
              className="w-full min-h-[220px] bg-gray-50/50 border border-black/5 rounded-2xl px-5 py-4 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-mono leading-relaxed focus:outline-none focus:border-evo-accent/30 focus:bg-white transition-all shadow-inner resize-y"
              placeholder="Filosofía, clases activas, reglas fijas…"
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-[11px] font-bold !text-black uppercase tracking-wide" style={{ color: '#000' }}>Reglas aprendidas · manual</label>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleClearAutoOnly}
                  className="text-[9px] text-neutral-800 font-bold uppercase tracking-widest hover:text-amber-800"
                >
                  Vaciar automáticas
                </button>
                <button
                  type="button"
                  onClick={handleClearLearned}
                  className="text-[9px] text-neutral-800 font-bold uppercase tracking-widest hover:text-red-600"
                >
                  Vaciar todo
                </button>
              </div>
            </div>
            <p className="text-[9px] text-neutral-800 leading-relaxed">
              Texto libre más abajo; las frases generadas al guardar ediciones de sesión se listan con fecha (puedes borrarlas una a una).
            </p>
            <textarea
              value={learnedManual}
              onChange={(e) => {
                setLearnedManual(e.target.value)
                setSaved(false)
              }}
              spellCheck={false}
              placeholder={DEFAULT_LEARNED_PLACEHOLDER}
              className="w-full min-h-[120px] bg-amber-50/40 border border-amber-100 rounded-2xl px-5 py-4 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-mono leading-relaxed focus:outline-none focus:border-amber-300/60 focus:bg-white transition-all shadow-inner resize-y"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold !text-black uppercase tracking-wide" style={{ color: '#000' }}>
              Contexto de otros mesociclos (referencia, opcional)
            </label>
            <p className="text-[9px] text-neutral-800 leading-relaxed">
              Extractos de programación previa o resúmenes por mesociclo. La IA debe inspirarse en ritmo y decisiones, no copiar sesiones.
            </p>
            <textarea
              value={referenceMesocycles}
              onChange={(e) => {
                setReferenceMesocycles(e.target.value)
                setSaved(false)
              }}
              spellCheck={false}
              placeholder={DEFAULT_REFERENCE_MESOCYCLES_PLACEHOLDER}
              className="w-full min-h-[100px] bg-slate-50/80 border border-slate-200 rounded-2xl px-5 py-4 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-mono leading-relaxed focus:outline-none focus:border-slate-400/50 focus:bg-white transition-all shadow-inner resize-y"
            />
            <div ref={driveSectionRef} className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A0A1A]">Importar desde Google Drive</p>
              <p className="text-[9px] text-neutral-800 leading-relaxed">
                En Google Cloud: activar Drive API y crear una cuenta de servicio con JSON. En Vercel: variables{' '}
                <code className="text-[9px] bg-slate-100 px-1 rounded">GOOGLE_DRIVE_PROGRAMMING_SA_JSON_B64</code> (recomendado) y compartir la carpeta con el{' '}
                <code className="text-[9px] bg-slate-100 px-1 rounded">client_email</code> del JSON (lector). Docs, Hojas y .txt/.md se concatenan al final del bloque de referencia.
              </p>
              <input
                type="password"
                autoComplete="off"
                value={driveAdminSecret}
                onChange={(e) => {
                  setDriveAdminSecret(e.target.value)
                  setDriveImportMsg('')
                }}
                placeholder="Clave admin (COACH_GUIDE_ADMIN_SECRET)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-[#1A0A1A] focus:border-slate-400 focus:outline-none"
              />
              <input
                type="text"
                value={driveFolderInput}
                onChange={(e) => {
                  setDriveFolderInput(e.target.value)
                  setDriveImportMsg('')
                }}
                placeholder="Opcional: enlace o ID de carpeta Drive …/folders/XXXX"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-[#1A0A1A] focus:border-slate-400 focus:outline-none font-mono"
              />
              <p className="text-[9px] text-neutral-800 leading-relaxed">
                Si lo dejas vacío, intentará encontrar automáticamente una carpeta llamada «programacion» o «programación».
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={driveImportBusy}
                  onClick={handleDriveImport}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {driveImportBusy ? 'Importando…' : 'Traer textos de la carpeta'}
                </button>
              </div>
              {driveImportMsg ? (
                <p className="text-[10px] leading-relaxed text-[#1A0A1A] whitespace-pre-wrap">{driveImportMsg}</p>
              ) : null}
            </div>
          </div>

          {autoEntries.length ? (
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[#1A0A1A] uppercase tracking-widest">
                Desde ediciones de sesión ({autoEntries.length})
              </label>
              <ul className="space-y-2">
                {autoEntries.map((e) => (
                  <li
                    key={e.id}
                    className="flex gap-3 items-start p-3 rounded-2xl border border-amber-100 bg-amber-50/30 text-xs text-[#1A0A1A]"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[9px] font-bold text-neutral-700 uppercase tracking-wider">{formatAutoDate(e.at)}</p>
                      <p className="leading-relaxed whitespace-pre-wrap">{e.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAuto(e.id)}
                      className="shrink-0 text-[9px] font-bold uppercase text-red-600 hover:text-red-700"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          <button
            onClick={handleReset}
            className="text-[10px] text-neutral-800 font-bold uppercase tracking-widest hover:text-red-600 transition-all"
          >
            Restaurar método base
          </button>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-[10px] text-neutral-800 font-bold uppercase tracking-widest hover:text-black transition-all">
              Cerrar
            </button>
            <button
              onClick={handleSave}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                saved
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-evo-accent text-white shadow-purple-500/20 hover:bg-evo-accent-hover'
              }`}
            >
              {saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
