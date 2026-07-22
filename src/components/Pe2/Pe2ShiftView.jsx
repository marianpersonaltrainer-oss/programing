import { useCallback, useEffect, useMemo, useState } from 'react'
import { getShiftProtocol, SHIFT_PROTOCOL_LINKS } from '../../constants/shiftProtocolResources.js'
import { evoBrand } from '../../constants/evoBrand.js'
import { createShiftProtocolLog, listMyShiftProtocolLogs } from '../../lib/shiftProtocols.js'
import { formatMadridDayHeading, madridTodayYmd } from '../../utils/shiftProtocolTime.js'
import ShiftProtocolLogList from './ShiftProtocolLogList.jsx'

const ACTION_META = {
  apertura: {
    title: 'Apertura',
    description: 'Prepara el centro y deja constancia de que el protocolo se ha realizado.',
    button: 'Registrar apertura',
  },
  cierre: {
    title: 'Cierre',
    description: 'Comprueba el centro al terminar y registra el resultado del protocolo.',
    button: 'Registrar cierre',
  },
}

function openOfficialLink(url, setError) {
  const opened = window.open(url, '_blank')
  if (!opened) {
    setError('No se ha podido abrir el protocolo. Permite las ventanas emergentes e inténtalo de nuevo.')
    return
  }
  opened.opener = null
}

export default function Pe2ShiftView({ profile }) {
  const today = useMemo(() => madridTodayYmd(), [])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('')
  const [result, setResult] = useState('completado')
  const [comment, setComment] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLogs(await listMyShiftProtocolLogs(today))
    } catch (e) {
      setError(e.message || 'No se han podido cargar tus registros.')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  function beginRecord(recordType) {
    setSelectedType(recordType)
    setResult('completado')
    setComment('')
    setConfirmed(false)
    setError('')
    setSuccess('')
  }

  async function handleSave(event) {
    event.preventDefault()
    const protocol = getShiftProtocol(selectedType)
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createShiftProtocolLog({
        recordType: selectedType,
        result,
        comment,
        allStepsConfirmed: confirmed,
        protocolVersion: protocol?.version,
      })
      setSuccess(`${ACTION_META[selectedType].title} guardado correctamente.`)
      setSelectedType('')
      setComment('')
      setConfirmed(false)
      await loadLogs()
    } catch (e) {
      setError(e.message || 'No se ha podido guardar el registro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        {profile?.full_name ? `Hola, ${profile.full_name}` : 'Equipo EVO'}
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold" style={{ color: evoBrand.text }}>
        Mi turno
      </h1>
      <p className="mt-2 text-sm capitalize" style={{ color: evoBrand.muted }}>
        {formatMadridDayHeading(today)} · hora de Granada
      </p>

      {error ? (
        <div role="alert" className="rounded-2xl border px-4 py-3 mt-5 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" className="rounded-2xl border px-4 py-3 mt-5 text-sm" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857' }}>
          {success}
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4 mt-7">
        {SHIFT_PROTOCOL_LINKS.map((protocol) => {
          const meta = ACTION_META[protocol.recordType]
          return (
            <article key={protocol.id} className="rounded-2xl border p-5" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>
                Protocolo {protocol.version}
              </p>
              <h2 className="font-evo-display text-2xl font-bold mt-2" style={{ color: evoBrand.text }}>
                {meta.title}
              </h2>
              <p className="text-sm leading-relaxed mt-2 min-h-[3.75rem]" style={{ color: evoBrand.muted }}>
                {meta.description}
              </p>
              <div className="grid gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => beginRecord(protocol.recordType)}
                  className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: evoBrand.accent }}
                >
                  {meta.button}
                </button>
                <button
                  type="button"
                  onClick={() => openOfficialLink(protocol.url, setError)}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-black/5"
                  style={{ borderColor: `${evoBrand.purple}55`, color: evoBrand.purple }}
                >
                  {protocol.label} ↗
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {selectedType ? (
        <form onSubmit={handleSave} className="rounded-2xl border p-5 sm:p-6 mt-6" style={{ backgroundColor: evoBrand.paleYellow, borderColor: `${evoBrand.purple}44` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>
                Nuevo registro
              </p>
              <h2 className="font-evo-display text-2xl font-bold mt-1" style={{ color: evoBrand.text }}>
                {ACTION_META[selectedType].title}
              </h2>
            </div>
            <button type="button" onClick={() => setSelectedType('')} className="text-sm font-semibold" style={{ color: evoBrand.muted }}>
              Cerrar
            </button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-bold" style={{ color: evoBrand.text }}>¿Cómo ha quedado?</legend>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                ['completado', 'Completado'],
                ['incidencia', 'Hay una incidencia'],
              ].map(([value, label]) => (
                <label key={value} className="cursor-pointer">
                  <input
                    className="sr-only peer"
                    type="radio"
                    name="shift-result"
                    value={value}
                    checked={result === value}
                    onChange={() => {
                      setResult(value)
                      setError('')
                    }}
                  />
                  <span className="block rounded-xl border px-3 py-3 text-center text-xs sm:text-sm font-bold bg-white peer-checked:border-[#A729AD] peer-checked:text-[#6A1F6D]">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {result === 'completado' ? (
            <label className="flex items-start gap-3 mt-5 rounded-xl bg-white p-4 border cursor-pointer" style={{ borderColor: `${evoBrand.purple}33` }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-5 w-5 accent-[#A729AD]"
              />
              <span className="text-sm font-semibold leading-relaxed" style={{ color: evoBrand.text }}>
                Confirmo que he realizado todos los pasos del protocolo correspondiente.
              </span>
            </label>
          ) : (
            <label className="block mt-5">
              <span className="text-sm font-bold" style={{ color: evoBrand.text }}>¿Qué paso no has podido completar?</span>
              <span className="block text-xs mt-1" style={{ color: evoBrand.muted }}>
                La incidencia queda registrada aunque el resto del protocolo sí esté realizado.
              </span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                required
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#A729AD]"
                style={{ borderColor: `${evoBrand.purple}44` }}
                placeholder="Explícalo de forma breve y clara…"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={saving || (result === 'completado' && !confirmed) || (result === 'incidencia' && !comment.trim())}
            className="mt-5 w-full rounded-xl px-5 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: evoBrand.accent }}
          >
            {saving ? 'Guardando…' : 'Guardar registro'}
          </button>
        </form>
      ) : null}

      <section className="rounded-2xl border overflow-hidden mt-7" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <div className="px-4 py-4 sm:px-5 border-b flex items-center justify-between gap-3" style={{ borderColor: `${evoBrand.purple}22` }}>
          <div>
            <h2 className="font-evo-display text-lg font-bold" style={{ color: evoBrand.text }}>Mis registros del día</h2>
            <p className="text-xs mt-1" style={{ color: evoBrand.muted }}>Puedes registrar varias aperturas y cierres.</p>
          </div>
          <button type="button" onClick={loadLogs} disabled={loading} className="text-xs font-bold" style={{ color: evoBrand.purple }}>
            Actualizar
          </button>
        </div>
        <ShiftProtocolLogList logs={logs} loading={loading} />
      </section>
    </div>
  )
}
