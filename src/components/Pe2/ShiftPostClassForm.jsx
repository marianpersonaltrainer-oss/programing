import { useEffect, useState } from 'react'
import { DISCOMFORT_STATUSES, WORK_VOLUME_OPTIONS } from '../../domain/shiftNote.js'
import { evoBrand } from '../../constants/evoBrand.js'

const DISCOMFORT_LABELS = {
  none: 'No tenía',
  stable: 'Estable',
  improved: 'Mejoró',
  worsened: 'Empeoró',
}

const EMPTY = {
  personName: '',
  isFirstClass: false,
  mobilityTechnique: '',
  discomfortStatus: '',
  discomfortZone: '',
  discomfortIntensity: '',
  workVolumePercent: '',
  loadsUsed: '',
  adaptedExercises: '',
}

function ChoiceButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
        active ? 'border-[#A729AD] bg-[#F4E6F5] text-[#6A1F6D]' : 'border-[#DCCEDD] bg-white text-[#5C4960]'
      }`}
    >
      {children}
    </button>
  )
}

export default function ShiftPostClassForm({ onSave, saving = false, firstClassRequired = false }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, isFirstClass: firstClassRequired }))
  const [error, setError] = useState('')

  useEffect(() => {
    if (firstClassRequired) {
      setForm((current) => ({ ...current, isFirstClass: true }))
    }
  }, [firstClassRequired])

  function update(field, value) {
    setError('')
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'discomfortStatus' && value === 'none'
        ? { discomfortZone: '', discomfortIntensity: 0 }
        : {}),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      await onSave({ noteType: 'post_class', ...form })
      setForm({ ...EMPTY, isFirstClass: firstClassRequired })
    } catch (e) {
      setError(e.message || 'No se ha podido guardar el seguimiento post-clase.')
    }
  }

  const discomfortNeedsDetail = form.discomfortStatus && form.discomfortStatus !== 'none'

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-4 sm:p-5" style={{ backgroundColor: evoBrand.paleYellow, borderColor: `${evoBrand.purple}33` }}>
      <label className="block">
        <span className="text-sm font-bold" style={{ color: evoBrand.text }}>Nombre de la persona</span>
        <input
          value={form.personName}
          onChange={(event) => update('personName', event.target.value)}
          maxLength={120}
          required
          className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#A729AD]"
          style={{ borderColor: `${evoBrand.purple}44` }}
          placeholder="Nombre y apellido"
        />
      </label>

      <label className="mt-4 flex items-start gap-3 rounded-xl border bg-white p-3 cursor-pointer" style={{ borderColor: `${evoBrand.purple}33` }}>
        <input
          type="checkbox"
          checked={form.isFirstClass}
          disabled={firstClassRequired}
          onChange={(event) => update('isFirstClass', event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-[#A729AD]"
        />
        <span className="text-sm font-semibold" style={{ color: evoBrand.text }}>Es su primera clase</span>
      </label>

      <section className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>1 · Movilidad / técnica</h3>
        <label className="block mt-2">
          <span className="text-sm font-bold" style={{ color: evoBrand.text }}>¿Qué observaste?</span>
          <textarea
            value={form.mobilityTechnique}
            onChange={(event) => update('mobilityTechnique', event.target.value)}
            maxLength={400}
            rows={3}
            required
            className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#A729AD]"
            style={{ borderColor: `${evoBrand.purple}44` }}
            placeholder="Movilidad, coordinación, técnica o aspecto que conviene seguir trabajando…"
          />
        </label>
      </section>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>2 · Molestia o lesión</legend>
        <p className="mt-2 text-sm font-bold" style={{ color: evoBrand.text }}>¿Cómo evolucionó durante la clase?</p>
        <div className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-4">
          {DISCOMFORT_STATUSES.map((status) => (
            <ChoiceButton key={status} active={form.discomfortStatus === status} onClick={() => update('discomfortStatus', status)}>
              {DISCOMFORT_LABELS[status]}
            </ChoiceButton>
          ))}
        </div>
        {discomfortNeedsDetail ? (
          <div className="grid gap-3 mt-3 sm:grid-cols-[1fr_8rem]">
            <label className="block">
              <span className="text-sm font-bold" style={{ color: evoBrand.text }}>Zona</span>
              <input
                value={form.discomfortZone}
                onChange={(event) => update('discomfortZone', event.target.value)}
                maxLength={400}
                required
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm"
                style={{ borderColor: `${evoBrand.purple}44` }}
                placeholder="Ej. hombro derecho"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold" style={{ color: evoBrand.text }}>Intensidad 0–10</span>
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                value={form.discomfortIntensity}
                onChange={(event) => update('discomfortIntensity', event.target.value)}
                required
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm"
                style={{ borderColor: `${evoBrand.purple}44` }}
              />
            </label>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>3 · Trabajo completado</legend>
        <p className="mt-2 text-sm font-bold" style={{ color: evoBrand.text }}>Volumen completado</p>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {WORK_VOLUME_OPTIONS.map((volume) => (
            <ChoiceButton key={volume} active={Number(form.workVolumePercent) === volume} onClick={() => update('workVolumePercent', volume)}>
              {volume} %
            </ChoiceButton>
          ))}
        </div>
        <label className="block mt-3">
          <span className="text-sm font-bold" style={{ color: evoBrand.text }}>Cargas utilizadas</span>
          <textarea
            value={form.loadsUsed}
            onChange={(event) => update('loadsUsed', event.target.value)}
            maxLength={400}
            rows={2}
            required
            className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm"
            style={{ borderColor: `${evoBrand.purple}44` }}
            placeholder="Ej. 2 mancuernas de 6 kg; barra a 30 kg…"
          />
        </label>
        <label className="block mt-3">
          <span className="text-sm font-bold" style={{ color: evoBrand.text }}>Ejercicios adaptados</span>
          <textarea
            value={form.adaptedExercises}
            onChange={(event) => update('adaptedExercises', event.target.value)}
            maxLength={400}
            rows={2}
            required
            className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm"
            style={{ borderColor: `${evoBrand.purple}44` }}
            placeholder="Indica los cambios; escribe “ninguno” si no hizo falta adaptar."
          />
        </label>
      </fieldset>

      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-5 w-full rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
        style={{ backgroundColor: evoBrand.accent }}
      >
        {saving ? 'Guardando…' : 'Guardar seguimiento post-clase'}
      </button>
    </form>
  )
}
