import { evoBrand } from '../../constants/evoBrand.js'
import { formatShiftLogMadrid } from '../../utils/shiftProtocolTime.js'

const DISCOMFORT_LABELS = {
  none: 'No tenía',
  stable: 'Estable',
  improved: 'Mejoró',
  worsened: 'Empeoró',
}

export default function ShiftNoteList({ notes, loading = false, profileNames = {}, shiftLabels = {}, showShift = false, emptyMessage }) {
  if (loading) {
    return <p className="py-5 text-sm text-center" style={{ color: evoBrand.muted }}>Cargando…</p>
  }
  if (!notes.length) {
    return (
      <p className="py-5 px-4 text-sm text-center" style={{ color: evoBrand.muted }}>
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className="divide-y" style={{ borderColor: `${evoBrand.purple}22` }}>
      {notes.map((note) => (
        <li key={note.id} className="px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              {note.note_type === 'post_class' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm" style={{ color: evoBrand.text }}>{note.person_name}</strong>
                  {note.is_first_class ? (
                    <span className="rounded-full bg-[#F4E6F5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: evoBrand.purple }}>
                      Primera clase
                    </span>
                  ) : null}
                </div>
              ) : (
                <strong className="text-sm" style={{ color: evoBrand.text }}>Novedad del equipo</strong>
              )}
              {profileNames[note.user_id] ? (
                <p className="text-xs font-semibold mt-1" style={{ color: evoBrand.purple }}>
                  {profileNames[note.user_id]}
                </p>
              ) : null}
              {showShift && note.shift_id ? (
                <p className="text-xs font-semibold mt-1" style={{ color: evoBrand.muted }}>
                  {shiftLabels[`${note.user_id}:${note.shift_id}`] || 'Turno'}
                </p>
              ) : null}
            </div>
            <time className="text-xs" dateTime={note.created_at} style={{ color: evoBrand.muted }}>
              {formatShiftLogMadrid(note.created_at)}
            </time>
          </div>

          {note.note_type === 'team' ? (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: evoBrand.text }}>
              {note.team_note}
            </p>
          ) : (
            <div className="grid gap-2 mt-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-[#F8F4F8] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: evoBrand.purple }}>Movilidad / técnica</p>
                <p className="mt-1 leading-relaxed" style={{ color: evoBrand.text }}>{note.mobility_technique}</p>
              </div>
              <div className="rounded-xl bg-[#F8F4F8] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: evoBrand.purple }}>Molestia o lesión</p>
                <p className="mt-1 font-semibold" style={{ color: evoBrand.text }}>
                  {DISCOMFORT_LABELS[note.discomfort_status] || note.discomfort_status}
                  {note.discomfort_status !== 'none' ? ` · ${note.discomfort_zone} · ${note.discomfort_intensity}/10` : ''}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F4F8] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: evoBrand.purple }}>Trabajo completado</p>
                <p className="mt-1 font-semibold" style={{ color: evoBrand.text }}>{note.work_volume_percent} %</p>
                <p className="mt-1 leading-relaxed" style={{ color: evoBrand.muted }}>Cargas: {note.loads_used}</p>
                <p className="mt-1 leading-relaxed" style={{ color: evoBrand.muted }}>Adaptaciones: {note.adapted_exercises}</p>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
