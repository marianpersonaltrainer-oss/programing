import { useEffect, useMemo, useState } from 'react'
import { updatePe2Week } from '../../lib/pe2Supabase.js'
import { evoBrand } from '../../constants/evoBrand.js'

const FIELDS = [
  {
    key: 'objective',
    label: 'Objetivo y foco de esta semana',
    placeholder: 'Qué debe desarrollar la semana, cómo enlaza con el mesociclo y qué no debe perderse.',
  },
  {
    key: 'approvedRules',
    label: 'Normas EVO aprobadas para esta programación',
    placeholder: 'Reglas operativas que deben respetarse. Solo decisiones ya aprobadas por Dirección.',
  },
  {
    key: 'constraints',
    label: 'Material, calendario o restricciones reales',
    placeholder: 'Material disponible, clases especiales, aforo, eventos o límites de esta semana.',
  },
  {
    key: 'language',
    label: 'Lenguaje y notas para entrenadores',
    placeholder: 'Terminología EVO, tono de los briefings y qué debe quedar claro para el equipo.',
  },
  {
    key: 'references',
    label: 'Referencias que la IA puede seguir',
    placeholder: 'Pega ejemplos o indicaciones concretas de tu método. No incluyas datos de clientes.',
  },
]

function clean(value) {
  return typeof value === 'string' ? value.slice(0, 5000) : ''
}

function readContext(week) {
  const raw = week?.data?.ai_context
  return Object.fromEntries(FIELDS.map(({ key }) => [key, clean(raw?.[key])]))
}

function buildPreview(context) {
  const sections = FIELDS
    .map(({ key, label }) => (context[key].trim() ? `## ${label}\n${context[key].trim()}` : ''))
    .filter(Boolean)

  return [
    '# Contexto operativo de esta semana',
    'Este bloque complementa el Método EVO y el catálogo de ejercicios; no los sustituye.',
    'No inventes movimientos, vídeos, reglas ni datos. Si falta una decisión, señálala para revisión.',
    ...sections,
  ].join('\n\n')
}

export default function Pe2AiPlanningPanel({ week, onSaved }) {
  const [context, setContext] = useState(() => readContext(week))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const preview = useMemo(() => buildPreview(context), [context])

  useEffect(() => {
    setContext(readContext(week))
    setMessage('')
  }, [week?.id])

  const update = (key, value) => setContext((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (!week?.id) return
    setSaving(true)
    setMessage('')
    try {
      const saved = await updatePe2Week(week.id, {
        data: { ...(week.data || {}), ai_context: context },
      })
      onSaved?.(saved)
      setMessage('Contexto guardado para esta semana.')
    } catch (error) {
      setMessage(error.message || 'No se pudo guardar el contexto.')
    } finally {
      setSaving(false)
    }
  }

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(preview)
      setMessage('Vista previa copiada.')
    } catch {
      setMessage('No se pudo copiar automáticamente. Puedes seleccionar el texto de abajo.')
    }
  }

  return (
    <section className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: evoBrand.border }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: evoBrand.accent }}>
            Preparar IA
          </p>
          <h2 className="mt-1 font-evo-display text-xl font-bold" style={{ color: evoBrand.text }}>
            Contexto de la programación
          </h2>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: evoBrand.muted }}>
            Aquí guardas tus prioridades, normas y referencias para esta semana. Se conserva dentro del borrador y queda listo para el generador asistido.
          </p>
        </div>
        <button type="button" onClick={save} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: evoBrand.accent }}>
          {saving ? 'Guardando…' : 'Guardar contexto'}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {FIELDS.map(({ key, label, placeholder }) => (
          <label key={key} className="grid gap-1.5">
            <span className="text-sm font-semibold" style={{ color: evoBrand.text }}>{label}</span>
            <textarea
              value={context[key]}
              onChange={(event) => update(key, event.target.value)}
              placeholder={placeholder}
              rows={3}
              maxLength={5000}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: evoBrand.border, color: evoBrand.text }}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 rounded-xl border p-4" style={{ borderColor: evoBrand.border, backgroundColor: '#FAF7FC' }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold" style={{ color: evoBrand.text }}>Vista previa que recibirá la IA</p>
          <button type="button" onClick={copyPreview} className="text-sm font-semibold" style={{ color: evoBrand.accent }}>
            Copiar
          </button>
        </div>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs leading-5" style={{ color: evoBrand.muted }}>
          {preview}
        </pre>
      </div>

      {message ? <p className="mt-3 text-sm" style={{ color: message.startsWith('No se pudo') ? '#B42318' : '#18794E' }}>{message}</p> : null}
    </section>
  )
}
