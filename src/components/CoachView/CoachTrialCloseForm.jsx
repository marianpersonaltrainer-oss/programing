import { useState } from 'react'
import {
  buildTrialCloseSummary,
  TRIAL_ENTRY_OPTIONS,
  TRIAL_PRIORITY_OPTIONS,
} from '../../utils/trialCloseSummary.js'
import { saveCoachTrialClose } from '../../lib/supabase.js'
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID())
  const linkedPersonReference = String(trial?.personReference || '').trim()

  function setValue(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setResult(null)
    setSaveError('')
    setSaved(false)
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
    setSaveError('')
    setSaved(false)
    setSubmissionId(crypto.randomUUID())
  }

  async function handleProtectedSave() {
    if (!result?.ok || saving || saved) return

    setSaving(true)
    setSaveError('')
    try {
      await saveCoachTrialClose({
        person_reference: linkedPersonReference || values.personReference,
        attendance: values.attendance,
        entry_point: values.entryPoint,
        priority: values.priority,
        adaptations: values.adaptations,
        reason: values.reason,
        submission_id: submissionId,
      })
      setSaved(true)
    } catch (error) {
      setSaveError(error?.message || 'trial_close_write_unavailable')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`mt-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm`} aria-label="Cierre de clase de prueba">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#D79BDD]">Clases de prueba</p>
          <h3 className={`mt-1 text-lg font-extrabold ${coachText.primary}`}>Cierre protegido de prueba</h3>
          <p className={`mt-1.5 text-sm leading-relaxed ${coachText.muted}`}>
            Solo lo que has visto en la clase. No repitas el chat, no hables de precios y no hagas diagnósticos.
          </p>
        </div>
        <span className="rounded-lg border border-amber-400/40 bg-amber-950/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-100">
          Sin envíos
        </span>
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-xs leading-relaxed text-[#F3EAF8]/75">
        Preparar no guarda nada. Solo se registra cuando pulses <strong>Guardar cierre protegido</strong>, con tu cuenta individual. Nunca envía mensajes ni cambia el CRM o WodBuster.
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
            Referencia interna de la prueba
          </label>
          <input
            value={values.personReference}
            onChange={(event) => setValue('personReference', event.target.value)}
            className={coachField}
            placeholder="Ej.: lead-001. No escribas nombre y apellidos."
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
              placeholder="Qué hubo que adaptar. No incluyas diagnósticos ni datos médicos; si hay que revisar algo, escribe «revisión con Marian»."
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
          Preparar cierre para revisar
        </button>
      </form>

      {result?.ok ? (
        <div className="mt-5 rounded-xl border border-emerald-400/35 bg-emerald-950/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Resumen preparado · siguiente estado: {result.nextStage}</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-emerald-50">{result.summary}</pre>
          <p className="mt-3 text-xs leading-relaxed text-emerald-100/85">La frecuencia, el programa y el precio los acuerda Marian con la persona antes de preparar la propuesta.</p>
          {saved ? (
            <p className="mt-4 rounded-lg border border-emerald-300/35 bg-emerald-900/25 px-3 py-2 text-sm font-bold text-emerald-100">
              Cierre guardado de forma privada. No se ha enviado ningún mensaje ni se ha modificado WodBuster o el CRM.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleProtectedSave}
                disabled={saving}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-65"
              >
                {saving ? 'Guardando cierre…' : 'Guardar cierre protegido'}
              </button>
              {saveError === 'individual_coach_identity_required' ? (
                <div className="mt-3 rounded-lg border border-amber-300/35 bg-amber-950/30 px-3 py-3 text-sm leading-relaxed text-amber-100">
                  Para guardar este cierre, entra primero con tu cuenta individual de EVO. El código compartido no puede guardar cierres.
                  <button
                    type="button"
                    onClick={() => window.location.assign('/?v2')}
                    className="mt-2 block font-bold underline underline-offset-2"
                  >
                    Entrar con mi cuenta
                  </button>
                </div>
              ) : null}
              {saveError && saveError !== 'individual_coach_identity_required' ? (
                <p className="mt-3 rounded-lg border border-red-300/35 bg-red-950/35 px-3 py-2 text-sm text-red-100">
                  No se ha guardado el cierre. Inténtalo de nuevo; no se ha enviado ni modificado nada.
                </p>
              ) : null}
            </>
          )}
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
