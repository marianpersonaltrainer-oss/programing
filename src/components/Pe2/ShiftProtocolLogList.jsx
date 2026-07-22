import { evoBrand } from '../../constants/evoBrand.js'
import { formatShiftLogMadrid } from '../../utils/shiftProtocolTime.js'

const RECORD_LABELS = { apertura: 'Apertura', cierre: 'Cierre' }
const RESULT_LABELS = { completado: 'Completado', incidencia: 'Incidencia' }

export default function ShiftProtocolLogList({ logs, loading = false, showCoach = false, profileNames = {} }) {
  if (loading) {
    return <p className="py-6 text-sm text-center" style={{ color: evoBrand.muted }}>Cargando registros…</p>
  }

  if (!logs.length) {
    return (
      <p className="py-6 px-4 text-sm text-center" style={{ color: evoBrand.muted }}>
        Todavía no hay registros para este día.
      </p>
    )
  }

  return (
    <ul className="divide-y" style={{ borderColor: `${evoBrand.purple}22` }}>
      {logs.map((log) => {
        const incident = log.result === 'incidencia'
        return (
          <li key={log.id} className="px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: evoBrand.text }}>
                    {RECORD_LABELS[log.record_type] || log.record_type}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: incident ? '#FEF2F2' : '#ECFDF5',
                      color: incident ? '#991B1B' : '#047857',
                    }}
                  >
                    {RESULT_LABELS[log.result] || log.result}
                  </span>
                </div>
                {showCoach ? (
                  <p className="text-xs font-semibold mt-1" style={{ color: evoBrand.purple }}>
                    {profileNames[log.user_id] || 'Entrenador'}
                  </p>
                ) : null}
              </div>
              <time className="text-xs" dateTime={log.created_at} style={{ color: evoBrand.muted }}>
                {formatShiftLogMadrid(log.created_at)}
              </time>
            </div>
            {log.comment ? (
              <p className="mt-3 rounded-xl px-3 py-2 text-sm leading-relaxed" style={{ backgroundColor: '#FEF2F2', color: '#7F1D1D' }}>
                {log.comment}
              </p>
            ) : null}
            <p className="mt-2 text-[10px] uppercase tracking-wide" style={{ color: evoBrand.muted }}>
              Protocolo {log.protocol_version}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
