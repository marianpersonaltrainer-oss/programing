import { useState } from 'react'
import {
  buildTrialCloseSummary,
  TRIAL_ENTRY_OPTIONS,
  TRIAL_FREQUENCY_OPTIONS,
  TRIAL_PRIORITY_OPTIONS,
} from '../../utils/trialCloseSummary.js'
import { coachBg, coachBorder, coachField, coachText } from './coachTheme.js'

const INITIAL_VALUES = {
  personReference: '',
  entryPoint: '',
  frequency: '',
  priority: '',
  adaptations: '',
  reason: '',
}

function ChoiceButtons({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
            value === option
              ? 'bg-[#6A1F6D] text-white border-[#6A1F6D]'
              : `${coachBg.cardAlt} border-[#6A1F6D]/30 ${coachText.primary} hover:border-[#A729AD]/50`
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export default function CoachTrialCloseForm() {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [result, setResult] = useState(null)

  function setValue(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setResult(null)
  }

  function handleSubmit(event) {
    event.preventDefault()
    setResult(buildTrialCloseSummary(values))
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
            Deja el resumen que necesita Marian para preparar una recomendación personal. Una idea clara, sin diagnóstico.
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
        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Nombre o referencia de la persona
          </label>
          <input
            value={values.personReference}
            onChange={(event) => setValue('personReference', event.target.value)}
            className={coachField}
            placeholder="Ej.: Ana G."
            autoComplete="off"
          />
        </div>

        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Punto de entrada recomendado</p>
          <ChoiceButtons options={TRIAL_ENTRY_OPTIONS} value={values.entryPoint} onChange={(value) => setValue('entryPoint', value)} />
        </div>

        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Frecuencia sugerida</p>
          <ChoiceButtons options={TRIAL_FREQUENCY_OPTIONS} value={values.frequency} onChange={(value) => setValue('frequency', value)} />
        </div>

        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Prioridad inicial</p>
          <ChoiceButtons options={TRIAL_PRIORITY_OPTIONS} value={values.priority} onChange={(value) => setValue('priority', value)} />
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Adaptaciones relevantes <span className="normal-case tracking-normal font-medium">(si las hay)</span>
          </label>
          <textarea
            value={values.adaptations}
            onChange={(event) => setValue('adaptations', event.target.value)}
            rows={2}
            className={coachField}
            placeholder="Solo la adaptación útil para entrenar. Sin diagnóstico ni historial médico."
          />
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Motivo de la recomendación
          </label>
          <textarea
            value={values.reason}
            onChange={(event) => setValue('reason', event.target.value)}
            rows={3}
            className={coachField}
            placeholder="Por qué este inicio le encaja ahora mismo."
          />
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
