import { useState, useEffect } from 'react'

const METHOD_KEY = 'programingevo_method'

export const DEFAULT_METHOD = `FILOSOFÍA EVO
EVO es un centro funcional con formato CrossFit pero con identidad propia. Adulto activo 28-55 años. Abierto a ejercicios nuevos, accesorios y creatividad.

CLASES ACTIVAS
EvoFuncional: fuerza + habilidad + WOD intenso
EvoBasics: técnica y progresión, juego siempre en calentamiento
EvoFit: fuerza moderada, sin técnica compleja, nadie sale destrozado
EvoHybrix: metabólica por bloques, equipos/parejas, máquinas + cardio
(EvoFuerza y EvoGimnástica: solo cuando se especifique en instrucciones)

REGLAS FIJAS
- No muscle ups, no deficit HSPU, no rope climb, no pegboard
- No overhead squat como ejercicio principal
- Thruster máx 1 vez/semana total
- Mismo squat con barra: máx 1 vez/semana por clase
- Landmine obligatorio 1 vez/semana en cada clase
- No mismo ejercicio principal en Funcional y Basics el mismo día

ESTILO DE PROGRAMACIÓN
- Clases distintas, no versiones escaladas de la misma sesión
- Feedback siempre con 3 puntos: Objetivo, Escalado, Coaching
- Timings con duración: (25'-40') FUERZA — 15min
- EvoFit: nunca KB Clean, Power Clean, Snatch ni movimientos olímpicos`

export function getMethodText() {
  try {
    const saved = localStorage.getItem(METHOD_KEY)
    return saved || DEFAULT_METHOD
  } catch {
    return DEFAULT_METHOD
  }
}

export function saveMethodText(text) {
  try {
    localStorage.setItem(METHOD_KEY, text)
  } catch {
    // ignore
  }
}

export default function MethodPanel({ onClose }) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setText(getMethodText())
  }, [])

  function handleSave() {
    saveMethodText(text)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    if (window.confirm('¿Restaurar el método por defecto? Se perderán tus cambios.')) {
      setText(DEFAULT_METHOD)
      saveMethodText(DEFAULT_METHOD)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white border border-black/5 rounded-3xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white">
          <div>
            <h2 className="text-display text-base font-bold text-evo-text uppercase tracking-tight">Tu Método EVO</h2>
            <p className="text-[10px] text-evo-muted font-bold mt-1 uppercase tracking-widest">
              REGLAS FIJAS DE PROGRAMACIÓN · DOCUMENTO VIVO
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-evo-muted hover:text-red-500 transition-all shadow-sm border border-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-8 pt-4 flex-shrink-0">
          <div className="flex items-start gap-3 px-4 py-3 bg-evo-accent/5 border border-evo-accent/10 rounded-2xl shadow-sm">
            <span className="text-evo-accent text-lg flex-shrink-0 mt--0.5">✦</span>
            <p className="text-[10px] text-evo-text font-medium leading-relaxed">
              Define aquí la filosofía de EVO, restricciones de material o reglas de timings.
              El agente leerá este texto <span className="font-bold text-evo-accent">siempre</span> antes de generar cualquier sesión o semana completa.
            </p>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 px-8 py-4 min-h-0">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setSaved(false) }}
            spellCheck={false}
            className="w-full h-full min-h-[400px] bg-gray-50/50 border border-black/5 rounded-2xl px-6 py-5 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-mono leading-relaxed focus:outline-none focus:border-evo-accent/30 focus:bg-white transition-all shadow-inner resize-none placeholder:!text-[#6B5A6B] placeholder:opacity-100"
            placeholder="Escribe aquí las reglas maestras..."
          />
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          <button
            onClick={handleReset}
            className="text-[10px] text-evo-muted font-bold uppercase tracking-widest hover:text-red-500 transition-all"
          >
            Restaurar Valores EVO
          </button>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-[10px] text-evo-muted font-bold uppercase tracking-widest hover:text-evo-text transition-all">
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
              {saved ? '✓ Guardado' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
