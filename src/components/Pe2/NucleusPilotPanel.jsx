import { useRef, useState } from 'react'
import { runNucleusPilotEvent } from '../../lib/nucleusPilot.js'

function newPilotKey() {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `preview-${random}`.toLowerCase()
}

export default function NucleusPilotPanel() {
  const pilotRef = useRef(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function runPilot() {
    if (!pilotRef.current) {
      pilotRef.current = {
        idempotencyKey: newPilotKey(),
        occurredAt: new Date().toISOString(),
      }
    }
    setLoading(true)
    setError('')
    try {
      setResult(await runNucleusPilotEvent(pilotRef.current))
    } catch (pilotError) {
      setError(String(pilotError?.message || 'nucleus_pilot_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      aria-label="Piloto técnico Nucleus"
      className="mb-6 rounded-2xl border border-[#A729AD]/30 bg-white/70 p-5"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-[#84278A]">
        Preview · Piloto técnico Nucleus
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Registra un evento sintético sin datos de clientes. Repetir valida la idempotencia.
      </p>
      <button
        type="button"
        onClick={runPilot}
        disabled={loading}
        className="mt-4 rounded-xl bg-[#A729AD] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading
          ? 'Registrando…'
          : result
            ? 'Reintentar el mismo evento'
            : 'Ejecutar piloto Nucleus'}
      </button>
      {result ? (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {result.created ? 'Evento creado' : 'Reintento idempotente'} · {result.eventId}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">Error: {error}</p>
      ) : null}
    </section>
  )
}
