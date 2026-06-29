import { Fragment } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import { buildPe2SessionMap } from '../../lib/pe2Supabase.js'
import { PE2_WEEKDAY_LABELS, PE2_WEEKDAY_NUMBERS } from './pe2Slot.js'
import SessionCell from './SessionCell.jsx'

export default function WeekGrid({ classTypes, sessions, loading }) {
  const sessionMap = buildPe2SessionMap(sessions)

  if (loading) {
    return (
      <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: `${evoBrand.purple}33`, color: evoBrand.muted }}>
        Cargando rejilla…
      </div>
    )
  }

  if (!classTypes?.length) {
    return (
      <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: `${evoBrand.purple}33`, color: evoBrand.muted }}>
        No hay clases activas en el catálogo. Ejecuta el seed V2.
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
    >
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[720px]"
          style={{
            gridTemplateColumns: `140px repeat(${PE2_WEEKDAY_NUMBERS.length}, minmax(110px, 1fr))`,
          }}
        >
          <div
            className="px-3 py-3 border-b border-r text-[10px] font-bold uppercase tracking-widest"
            style={{ borderColor: `${evoBrand.purple}22`, color: evoBrand.purple, backgroundColor: evoBrand.cardAlt }}
          >
            Clase
          </div>
          {PE2_WEEKDAY_LABELS.map((day) => (
            <div
              key={day}
              className="px-2 py-3 border-b text-center text-[10px] font-bold uppercase tracking-widest"
              style={{ borderColor: `${evoBrand.purple}22`, color: evoBrand.muted, backgroundColor: evoBrand.cardAlt }}
            >
              {day}
            </div>
          ))}

          {classTypes.map((ct) => (
            <Fragment key={ct.id}>
              <div
                className="px-3 py-3 border-b border-r flex items-center"
                style={{ borderColor: `${evoBrand.purple}16`, backgroundColor: evoBrand.card }}
              >
                <span className="text-[12px] font-semibold" style={{ color: evoBrand.text }}>
                  {ct.label}
                </span>
              </div>
              {PE2_WEEKDAY_NUMBERS.map((weekday) => {
                const session = sessionMap.get(`${ct.id}:${weekday}`)
                return (
                  <div
                    key={`${ct.id}-${weekday}`}
                    className="p-2 border-b"
                    style={{ borderColor: `${evoBrand.purple}16`, backgroundColor: evoBrand.card }}
                  >
                    <SessionCell session={session} empty={!session} />
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
