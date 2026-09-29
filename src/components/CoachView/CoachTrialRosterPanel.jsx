import { useEffect, useState } from 'react'
import { listCoachTrialRoster } from '../../lib/supabase.js'
import { coachBg, coachBorder, coachText } from './coachTheme.js'

function when(iso) {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    })
  } catch { return '' }
}

function profileHint(profile) {
  if (!profile || typeof profile !== 'object') return ''
  return String(profile.precaution || profile.observe || profile.objective || '').trim()
}

export default function CoachTrialRosterPanel({ onOpenTrial, onStatusChange, variant = 'default' }) {
  const [roster, setRoster] = useState([])
  const [state, setState] = useState('loading')
  useEffect(() => {
    let current = true
    listCoachTrialRoster().then((items) => {
      if (current) {
        setRoster(items)
        setState('ready')
        onStatusChange?.({ state: 'ready', count: items.length })
      }
    }).catch(() => {
      if (current) {
        setState('unavailable')
        onStatusChange?.({ state: 'unavailable', count: 0 })
      }
    })
    return () => { current = false }
  }, [onStatusChange])

  if (state === 'loading') {
    return (
      <section className={`coach-roster coach-roster-status ${variant === 'inline' ? 'mt-5' : 'mx-4 mb-4'} border p-4`} aria-live="polite">
        <p className="coach-eyebrow">Personas nuevas</p>
        <p className={`mt-1 text-sm font-semibold ${coachText.primary}`}>Comprobando si tienes alguna prueba asignada…</p>
      </section>
    )
  }

  if (state === 'unavailable') {
    return (
      <section className={`coach-roster coach-roster-status coach-roster-status-warning ${variant === 'inline' ? 'mt-5' : 'mx-4 mb-4'} border p-4`} aria-live="polite">
        <p className="coach-eyebrow">Personas nuevas</p>
        <h2 className={`mt-1 text-base font-extrabold ${coachText.primary}`}>Aún no se han podido cargar las pruebas</h2>
        <p className={`mt-2 text-sm leading-relaxed ${coachText.muted}`}>No des nada por confirmado. La oficina revisará la conexión con WodBuster antes de mostrar una persona aquí.</p>
      </section>
    )
  }
  return (
    <section className={`coach-roster ${variant === 'inline' ? 'mt-5' : 'mx-4 mb-4'} border ${coachBorder} p-4`} aria-label="Pruebas asignadas">
      <div className="flex items-start justify-between gap-3">
        <div><p className="coach-eyebrow">Acompañamientos</p><h2 className={`mt-1 text-base font-extrabold ${coachText.primary}`}>Personas que conocerás</h2></div>
        <span className="coach-roster-count border px-2.5 py-1 text-xs font-bold">{roster.length}</span>
      </div>
      {roster.length === 0 ? (
        <p className={`mt-3 text-sm leading-relaxed ${coachText.muted}`}>No hay ninguna clase de prueba asignada a tu cuenta en los próximos siete días.</p>
      ) : <ul className="coach-roster-list mt-3 divide-y overflow-hidden border">{roster.map((trial) => (
        <li key={trial.sourceEventId} className="bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm font-bold ${coachText.primary}`}>{trial.personReference}</p>
              <p className={`mt-1 text-xs ${coachText.muted}`}>{trial.classLabel} · {when(trial.sessionAt)}</p>
            </div>
            <span className="coach-trial-ready">Preparada</span>
          </div>
          {trial.briefSource ? <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#6A1F6D]">Contexto preparado · {trial.briefSource}</p> : null}
          {profileHint(trial.profile) ? <p className="coach-trial-note mt-2 rounded-lg border px-2.5 py-2 text-xs leading-relaxed"><strong>A tener en cuenta: </strong>{profileHint(trial.profile)}</p> : null}
          <button type="button" onClick={() => onOpenTrial(trial)} className="coach-neutral-button mt-3 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wide">Ver ficha antes de la clase</button>
        </li>
      ))}</ul>}
      <p className={`mt-3 text-[11px] leading-relaxed ${coachText.muted}`}>Una reserva no confirma asistencia. La nota se completa solo después de la clase.</p>
    </section>
  )
}
