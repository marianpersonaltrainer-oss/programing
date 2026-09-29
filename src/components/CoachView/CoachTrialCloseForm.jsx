import { useMemo, useState } from 'react'
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

const ATTENDANCE_OPTIONS = [
  { value: 'vino', label: 'Vino', hint: 'Hacemos su cierre' },
  { value: 'canceló', label: 'Canceló', hint: 'No hubo prueba' },
  { value: 'cambió fecha', label: 'Cambió fecha', hint: 'Queda pendiente' },
  { value: 'no vino', label: 'No vino', hint: 'Revisar seguimiento' },
]

const ENTRY_DETAILS = {
  'EVO Basics': 'Empezar despacio y con base.',
  'EVO Intermedio': 'Ya tiene una base para avanzar.',
  'EVO Funcional': 'Trabajo más completo y aplicado.',
  'Revisar con Marian': 'Hay algo que valorar antes.',
}

const PRIORITY_DETAILS = {
  'Retomar y crear constancia': { short: 'Crear hábito', hint: 'Volver poco a poco.' },
  'Moverse con seguridad y confianza': { short: 'Ganar confianza', hint: 'Sentirse segura al moverse.' },
  'Mejorar técnica y fuerza': { short: 'Técnica y fuerza', hint: 'Construir una buena base.' },
  'Coordinación y aprendizaje de movimientos': { short: 'Aprender movimientos', hint: 'Entender y coordinar.' },
  'Otro objetivo inicial': { short: 'Otro objetivo', hint: 'Lo revisará Marian.' },
}

const MISSING_LABELS = {
  persona: 'la referencia de la prueba',
  asistencia: 'si la persona vino',
  'punto de entrada': 'por dónde empezaría',
  prioridad: 'qué le ayudaría primero',
  motivo: 'una observación breve de la clase',
}

function ChoiceCards({ options, value, onChange, getLabel, getHint, labelledBy }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby={labelledBy}>
      {options.map((option) => {
        const optionValue = typeof option === 'string' ? option : option.value
        const selected = value === optionValue
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(optionValue)}
            className={`min-h-[70px] rounded-xl border px-3 py-3 text-left transition ${selected
              ? 'border-[#6A1F6D] bg-[#F6E9EF] text-[#212121] shadow-sm'
              : 'border-[#DDD2C2] bg-white text-[#212121] hover:border-[#6A1F6D]/50 hover:bg-[#FCFAF5]'
            }`}
          >
            <span className="block text-sm font-bold leading-tight">{getLabel(option)}</span>
            {getHint(option) ? (
              <span className={`mt-1 block text-[11px] leading-snug ${selected ? 'text-[#6A1F6D]/75' : 'text-[#6F6B68]'}`}>
                {getHint(option)}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function SectionTitle({ step, title, help, isMissing, id }) {
  return (
    <div className="mb-3 flex items-start gap-3" id={id}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-xs font-black ${isMissing ? 'bg-[#6A1F6D] text-white' : 'bg-white text-[#6A1F6D] border border-[#DDD2C2]'}`}>
        {step}
      </span>
      <div>
        <p className="text-sm font-extrabold text-[#0C0B0C]">{title}</p>
        {help ? <p className="mt-0.5 text-xs leading-relaxed text-[#0C0B0C]/60">{help}</p> : null}
      </div>
    </div>
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
  const linkedSourceEventId = String(trial?.sourceEventId || '').trim()
  const trialProfile = trial?.profile && typeof trial.profile === 'object' ? trial.profile : {}

  const draft = useMemo(() => buildTrialCloseSummary({
    ...values,
    personReference: linkedPersonReference || values.personReference,
  }), [linkedPersonReference, values])
  const firstMissing = draft.missing?.[0] || ''
  const isReady = draft.ok

  function setValue(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setResult(null)
    setSaveError('')
    setSaved(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    setResult(draft)
    if (!draft.ok) {
      const targetId = `trial-close-${firstMissing.replaceAll(' ', '-')}`
      window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }
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
        person_reference: linkedPersonReference,
        attendance: values.attendance,
        entry_point: values.entryPoint,
        priority: values.priority,
        adaptations: values.adaptations,
        reason: values.reason,
        submission_id: submissionId,
        source_event_id: linkedSourceEventId,
      })
      setSaved(true)
    } catch (error) {
      setSaveError(error?.message || 'trial_close_write_unavailable')
    } finally {
      setSaving(false)
    }
  }

  // Una prueba no se abre creando una ficha a mano: debe venir del relevo
  // operativo de WodBuster y estar asignada a la identidad individual del coach.
  // Así evitamos cierres atribuidos a la persona equivocada.
  if (!linkedSourceEventId || !linkedPersonReference) {
    return (
      <section id="cierre-prueba" className={`coach-trial-form mt-6 ${coachBg.card} border ${coachBorder} p-5`} aria-label="Valoración de clase de prueba">
        <p className="coach-eyebrow">Clases de prueba</p>
        <h3 className={`mt-1 text-xl font-extrabold ${coachText.primary}`}>Aquí aparecerá su ficha</h3>
        <p className={`mt-2 text-sm leading-relaxed ${coachText.muted}`}>
          Cuando WodBuster asigne una prueba a tu turno, verás aquí la persona, la hora y lo importante para acompañarla bien.
        </p>
        <div className="coach-trial-card mt-4 rounded-xl border border-[#DDD2C2] px-4 py-3 text-sm leading-relaxed text-[#212121]/78">
          <p className="font-bold text-[#0C0B0C]">No tienes que escribir ningún nombre.</p>
          <p className="mt-1">Entra en <strong>Mi turno</strong> → <strong>Clases de prueba</strong> → <strong>Abrir ficha y valoración</strong>. Después de la clase podrás dejar tu valoración.</p>
        </div>
        <p className={`mt-4 text-xs leading-relaxed ${coachText.muted}`}>No se envía ningún mensaje ni se modifica WodBuster desde aquí.</p>
      </section>
    )
  }

  return (
    <section id="cierre-prueba" className={`coach-trial-form mt-6 ${coachBg.card} border ${coachBorder} p-4 sm:p-5`} aria-label="Valoración de clase de prueba">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="coach-eyebrow">Después de la clase de prueba</p>
          <h3 className={`mt-1 text-xl font-extrabold ${coachText.primary}`}>Cuéntale a Marian cómo ha ido</h3>
          <p className={`mt-1 text-sm leading-relaxed ${coachText.muted}`}>Marca solo lo que has visto. Marian recibirá un resumen, no un diagnóstico.</p>
        </div>
        <span className="coach-status-chip shrink-0 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
          Sin mensajes
        </span>
      </div>

      <div className={`coach-trial-card mt-4 rounded-xl border border-[#DDD2C2] px-3 py-3`} aria-live="polite">
        {isReady ? (
          <p className="text-sm font-bold text-[#0C0B0C]">Listo para ver el resumen.</p>
        ) : (
          <p className="text-sm font-bold text-[#0C0B0C]">Siguiente paso: <span className="text-[#6A1F6D]">elige {MISSING_LABELS[firstMissing]}</span></p>
        )}
        <p className="mt-1 text-xs leading-relaxed text-[#0C0B0C]/62">No se guarda nada hasta que revises y pulses Guardar nota.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-6">
        <div className="coach-trial-card rounded-xl border border-[#DDD2C2] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6A1F6D]">Ficha de la prueba</p>
            <p className={`mt-1 text-base font-bold ${coachText.primary}`}>{linkedPersonReference}</p>
            {trial?.briefSource ? <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#6A1F6D]">Contexto preparado · {trial.briefSource}</p> : null}
            {trial?.classLabel || trial?.sessionAt ? (
              <p className={`mt-1 text-xs ${coachText.muted}`}>{[trial?.classLabel, trial?.sessionAt ? new Date(trial.sessionAt).toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : ''].filter(Boolean).join(' · ')}</p>
            ) : null}
            {Object.keys(trialProfile).length ? (
              <dl className="mt-4 grid gap-3 border-t border-[#6A1F6D]/15 pt-3 text-sm">
                {[
                  ['objective', 'Objetivo'],
                  ['experience', 'Experiencia'],
                  ['context', 'Contexto'],
                  ['precaution', 'A tener en cuenta'],
                  ['observe', 'Qué observar'],
                ].map(([key, label]) => trialProfile[key] ? (
                  <div key={key}>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-[#6A1F6D]">{label}</dt>
                    <dd className="mt-1 leading-relaxed text-[#0C0B0C]/78">{trialProfile[key]}</dd>
                  </div>
                ) : null)}
              </dl>
            ) : null}
        </div>

        <div id="trial-close-asistencia" className="coach-trial-card rounded-xl border border-[#DDD2C2] p-4">
          <SectionTitle step="1" title="¿Qué ha pasado con la prueba?" help="Marca el estado real de hoy." isMissing={firstMissing === 'asistencia'} id="trial-close-asistencia-title" />
          <ChoiceCards options={ATTENDANCE_OPTIONS} value={values.attendance} onChange={(value) => setValue('attendance', value)} getLabel={(option) => option.label} getHint={(option) => option.hint} labelledBy="trial-close-asistencia-title" />
        </div>

        <div id="trial-close-punto-de-entrada" className="coach-trial-card rounded-xl border border-[#DDD2C2] p-4">
          <SectionTitle step="2" title="¿En qué nivel encaja?" help="Elige el nivel que mejor encaja con lo que has visto." isMissing={firstMissing === 'punto de entrada'} id="trial-close-punto-de-entrada-title" />
          <ChoiceCards options={TRIAL_ENTRY_OPTIONS} value={values.entryPoint} onChange={(value) => setValue('entryPoint', value)} getLabel={(option) => option} getHint={(option) => ENTRY_DETAILS[option]} labelledBy="trial-close-punto-de-entrada-title" />
        </div>

        <div id="trial-close-prioridad" className="coach-trial-card rounded-xl border border-[#DDD2C2] p-4">
          <SectionTitle step="3" title="¿Qué le ayudaría primero?" help="Esta elección desbloquea el cierre." isMissing={firstMissing === 'prioridad'} id="trial-close-prioridad-title" />
          <ChoiceCards options={TRIAL_PRIORITY_OPTIONS} value={values.priority} onChange={(value) => setValue('priority', value)} getLabel={(option) => PRIORITY_DETAILS[option]?.short || option} getHint={(option) => PRIORITY_DETAILS[option]?.hint} labelledBy="trial-close-prioridad-title" />
        </div>

        <div id="trial-close-motivo" className="coach-trial-card rounded-xl border border-[#DDD2C2] p-4">
          <SectionTitle step="4" title="Una observación para Marian" help="Una o dos frases sobre cómo fue y por qué propones ese inicio." isMissing={firstMissing === 'motivo'} id="trial-close-motivo-title" />
          <textarea
            value={values.reason}
            onChange={(event) => setValue('reason', event.target.value)}
            rows={3}
            className={coachField}
            placeholder="Ej.: Le costó mantener el ritmo, pero siguió bien las indicaciones. Empezaría con una base tranquila."
            aria-labelledby="trial-close-motivo-title"
          />
          <details className="mt-3 rounded-lg border border-[#6A1F6D]/18 bg-white px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-bold text-[#6A1F6D]">Añadir una adaptación relevante (opcional)</summary>
            <textarea
              value={values.adaptations}
              onChange={(event) => setValue('adaptations', event.target.value)}
              rows={2}
              className={`${coachField} mt-3`}
              placeholder="Solo si tuviste que adaptar algo. Sin diagnósticos ni datos médicos."
            />
          </details>
        </div>

        {result && !result.ok ? (
          <p className="rounded-xl border border-[#6A1F6D]/35 bg-[#FFFFE2] px-3 py-3 text-sm font-semibold text-[#0C0B0C]">
            Completa: {result.missing.map((item) => MISSING_LABELS[item]).join(', ')}.
          </p>
        ) : null}

        <button type="submit" disabled={!isReady} className="coach-primary-button w-full py-4 uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40">
          {isReady ? 'Ver resumen' : `Completa: ${MISSING_LABELS[firstMissing]}`}
        </button>
      </form>

      {result?.ok ? (
        <div className="mt-5 rounded-xl border border-[#6A1F6D]/25 bg-[#FFFFE2] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6A1F6D]">Resumen preparado · siguiente estado: {result.nextStage}</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#0C0B0C]">{result.summary}</pre>
          <p className="mt-3 text-xs leading-relaxed text-[#0C0B0C]/70">La frecuencia, el programa y el precio los acuerda Marian con la persona antes de preparar la propuesta.</p>
          {saved ? (
            <p className="mt-4 rounded-lg border border-[#6A1F6D]/25 bg-white px-3 py-2 text-sm font-bold text-[#0C0B0C]">
              Nota guardada de forma privada. No se ha enviado ningún mensaje ni se ha modificado WodBuster o el CRM.
            </p>
          ) : (
            <>
              <button type="button" onClick={handleProtectedSave} disabled={saving} className="mt-4 w-full rounded-xl bg-[#6A1F6D] py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#A729AD] disabled:cursor-wait disabled:opacity-65">
                {saving ? 'Guardando nota…' : 'Guardar nota'}
              </button>
              {saveError === 'individual_coach_identity_required' ? (
                <div className="mt-3 rounded-lg border border-amber-300/35 bg-amber-950/30 px-3 py-3 text-sm leading-relaxed text-amber-100">
                  Para guardar este cierre, entra primero con tu cuenta individual de EVO. El código compartido no puede guardar cierres.
                  <button type="button" onClick={() => window.location.assign('/?v2')} className="mt-2 block font-bold underline underline-offset-2">Entrar con mi cuenta</button>
                </div>
              ) : null}
              {saveError && saveError !== 'individual_coach_identity_required' ? (
                <p className="mt-3 rounded-lg border border-red-300/35 bg-red-950/35 px-3 py-2 text-sm text-red-100">
                  No se ha guardado el cierre. Inténtalo de nuevo; no se ha enviado ni modificado nada.
                </p>
              ) : null}
            </>
          )}
          <button type="button" onClick={reset} className="mt-4 rounded-lg border border-emerald-300/35 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-900/35">
            Preparar otro cierre
          </button>
        </div>
      ) : null}
    </section>
  )
}
