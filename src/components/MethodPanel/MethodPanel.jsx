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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#111] border border-white/8 rounded-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">Tu Método EVO</h2>
            <p className="text-[10px] text-evo-muted mt-0.5">
              Documento vivo — edítalo cuando quieras. Se incluye en cada generación automáticamente.
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-evo-muted hover:text-white transition-colors">
            ×
          </button>
        </div>

        {/* Info */}
        <div className="px-6 pt-3 flex-shrink-0">
          <div className="flex items-start gap-2 px-3 py-2.5 bg-[#7B2FBE]/10 border border-[#7B2FBE]/20 rounded-xl">
            <span className="text-[#A855F7] text-xs flex-shrink-0 mt-0.5">✦</span>
            <p className="text-[10px] text-evo-muted leading-relaxed">
              Escribe aquí tus reglas de programación, filosofía, restricciones y preferencias.
              La IA lo leerá siempre antes de generar. Añade, quita o cambia lo que necesites según va evolucionando EVO.
            </p>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 px-6 py-3 min-h-0">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setSaved(false) }}
            spellCheck={false}
            className="w-full h-full min-h-[400px] bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-3 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-[#7B2FBE]/40 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleReset}
            className="text-xs text-evo-muted hover:text-white transition-colors"
          >
            Restaurar por defecto
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-xs text-evo-muted hover:text-white transition-colors">
              Cerrar
            </button>
            <button
              onClick={handleSave}
              className={`px-5 py-2 rounded-lg text-xs font-medium transition-colors ${
                saved
                  ? 'bg-[#2FBE7B]/20 text-[#2FBE7B] border border-[#2FBE7B]/30'
                  : 'bg-[#7B2FBE] hover:bg-[#9B4FDE] text-white'
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
