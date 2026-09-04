import { useState } from 'react'
import {
  buildTrialCloseSummary,
  TRIAL_ENTRY_OPTIONS,
  TRIAL_PRIORITY_OPTIONS,
} from '../../utils/trialCloseSummary.js'
import { coachBg, coachBorder, coachField, coachText } from './coachTheme.js'

const INITIAL_VALUES = {
  personReference: '',
  attendance: 'vino',
  entryPoint: '',
  priority: '',
  adaptations: '',
  reason: '',
}

function ChoiceSelect({ options, value, onChange, placeholder }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${coachField} min-h-11`}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

export default function CoachTrialCloseForm({ trial = null }) {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [result, setResult] = useState(null)
  const linkedPersonReference = String(trial?.personReference || '').trim()

  function setValue(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setResult(null)
  }

  function handleSubmit(event) {
    event.preventDefault()
    setResult(buildTrialCloseSummary({
      ...values,
      personReference: linkedPersonReference || values.personReference,
    }))
  }

  function reset() {
    setValues(INITIAL_VALUES)
    setResult(null)
  }

  return (
    <section className={`mt-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm`} aria-label="Cierre de clase de prueba">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#D79BDD]">Clases de prueba</p>
          <h3 className={`mt-1 text-lg font-extrabold ${coachText.primary}`}>Cierre para propuesta</h3>
          <p className={`mt-1.5 text-sm leading-relaxed ${coachText.muted}`}>
            Solo lo que has visto en la clase. No repitas el chat, no hables de precios y no hagas diagnósticos.
          </p>
        </div>
        <span className="rounded-lg border border-amber-400/40 bg-amber-950/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-100">
          Modo local
        </span>
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-xs leading-relaxed text-[#F3EAF8]/75">
        Esta primera versión no guarda ni envía datos. Solo prepara el cierre en esta pantalla; aún no cambia el CRM ni WodBuster.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {linkedPersonReference ? (
          <div className="rounded-xl border border-[#A729AD]/35 bg-[#6A1F6D]/15 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#D79BDD]">Cierre pendiente para</p>
            <p className={`mt-1 text-sm font-bold ${coachText.primary}`}>{linkedPersonReference}</p>
          </div>
        ) : (
        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Persona de la prueba
          </label>
          <input
            value={values.personReference}
            onChange={(event) => setValue('personReference', event.target.value)}
            className={coachField}
            placeholder="Ej.: Ana G. (cuando aún no esté conectado a la reserva)"
            autoComplete="off"
          />
        </div>
        )}

        <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#D79BDD]">Tus cinco observaciones de la prueba</p>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Asistencia</p>
            <ChoiceSelect options={['vino', 'canceló', 'cambió fecha', 'no vino']} value={values.attendance} onChange={(value) => setValue('attendance', value)} placeholder="Elige una opción" />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Punto de entrada recomendado</p>
            <ChoiceSelect options={TRIAL_ENTRY_OPTIONS} value={values.entryPoint} onChange={(value) => setValue('entryPoint', value)} placeholder="Elige el punto de entrada" />
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Prioridad inicial</p>
            <ChoiceSelect options={TRIAL_PRIORITY_OPTIONS} value={values.priority} onChange={(value) => setValue('priority', value)} placeholder="Elige una prioridad" />
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
              Adaptaciones relevantes <span className="normal-case tracking-normal font-medium">(si las hay)</span>
            </label>
            <textarea
              value={values.adaptations}
              onChange={(event) => setValue('adaptations', event.target.value)}
              rows={3}
              className={coachField}
              placeholder="Qué hubo que adaptar, cómo se movió o qué referencia técnica conviene saber. Si no hizo falta, escribe «ninguna»."
            />
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
              ¿Por qué recomiendas este inicio?
            </label>
            <textarea
              value={values.reason}
              onChange={(event) => setValue('reason', event.target.value)}
              rows={3}
              className={coachField}
              placeholder="Dos frases: cómo fue la clase, qué le cuesta o hace bien y por qué este es el mejor punto de partida. Sin diagnóstico."
            />
          </div>
        </div>

        {result && !result.ok ? (
          <p className="rounded-xl border border-red-400/40 bg-red-950/40 px-3 py-2.5 text-sm text-red-100">
            Falta: {result.missing.join(', ')}.
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-xl bg-[#A729AD] py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6A1F6D]"
        >
          Preparar cierre
        </button>
      </form>

      {result?.ok ? (
        <div className="mt-5 rounded-xl border border-emerald-400/35 bg-emerald-950/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Resumen preparado · siguiente estado: {result.nextStage}</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-emerald-50">{result.summary}</pre>
          <p className="mt-3 text-xs leading-relaxed text-emerald-100/85">La frecuencia, el programa y el precio los acuerda Marian con la persona antes de preparar la propuesta.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg border border-emerald-300/35 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-900/35"
          >
            Preparar otro cierre
          </button>
        </div>
      ) : null}
    </section>
  )
}
