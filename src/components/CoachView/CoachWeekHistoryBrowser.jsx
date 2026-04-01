import { useEffect, useMemo, useState } from 'react'
import { getHistoryForMesocycle, listMesocyclesInHistory } from '../../hooks/useWeekHistory.js'
import { SESSION_BLOCKS } from './coachViewConstants.js'
import { sessionText } from './coachViewUtils.js'
import CoachFormattedSession from './CoachFormattedSession.jsx'
import { coachBg, coachBorder, coachText } from './coachTheme.js'

export default function CoachWeekHistoryBrowser() {
  const [mesos, setMesos] = useState([])
  const [meso, setMeso] = useState('')
  const [semana, setSemana] = useState('')

  useEffect(() => {
    setMesos(listMesocyclesInHistory())
  }, [])

  useEffect(() => {
    if (!meso && mesos.length) setMeso(mesos[mesos.length - 1])
  }, [meso, mesos])

  const entries = useMemo(() => (meso ? getHistoryForMesocycle(meso) : []), [meso])

  useEffect(() => {
    if (!entries.length) {
      setSemana('')
      return
    }
    setSemana((prev) => {
      if (prev && entries.some((e) => String(e.semana) === String(prev))) return prev
      return String(entries[entries.length - 1].semana)
    })
  }, [meso, entries])

  const selected = entries.find((e) => String(e.semana) === String(semana))
  const weekData = selected?.weekDataFull
  const dias = weekData?.dias || []

  return (
    <section className={`mb-10 rounded-2xl border ${coachBorder} ${coachBg.card} p-5 sm:p-6 space-y-5`}>
      <div>
        <h3 className={`text-base font-black uppercase tracking-wide ${coachText.title} font-evo-display mb-1`}>
          Historial en este dispositivo
        </h3>
        <p className={`text-sm ${coachText.muted} leading-relaxed`}>
          Semanas guardadas en <code className="text-xs bg-black/5 px-1 rounded">programingevo_history</code> (localStorage).
          Solo lectura; no sustituye la semana activa publicada.
        </p>
      </div>

      {mesos.length === 0 ? (
        <p className={`text-sm ${coachText.muted}`}>
          Aún no hay semanas en historial. Se añaden al generar/publicar desde la app del programador.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 min-w-[160px]">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>Mesociclo</span>
              <select
                value={meso}
                onChange={(e) => setMeso(e.target.value)}
                className={`rounded-xl border ${coachBorder} px-3 py-2 text-sm ${coachText.primary} bg-white`}
              >
                {mesos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-[120px]">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>Semana</span>
              <select
                value={semana}
                onChange={(e) => setSemana(e.target.value)}
                className={`rounded-xl border ${coachBorder} px-3 py-2 text-sm ${coachText.primary} bg-white`}
              >
                {entries.map((e) => (
                  <option key={e.semana} value={String(e.semana)}>
                    S{e.semana}
                    {e.titulo ? ` — ${e.titulo.slice(0, 42)}${e.titulo.length > 42 ? '…' : ''}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {weekData ? (
            <div className="space-y-6 pt-2">
              {weekData.resumen ? (
                <div className={`rounded-xl border ${coachBorder} ${coachBg.cardMuted} px-4 py-3`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.accent} mb-1`}>Resumen</p>
                  <p className={`text-sm font-bold ${coachText.primary}`}>
                    {weekData.resumen.estimulo} · {weekData.resumen.intensidad}
                    {weekData.resumen.foco ? ` · ${weekData.resumen.foco}` : ''}
                  </p>
                  {weekData.resumen.nota ? (
                    <p className={`text-sm mt-2 ${coachText.muted}`}>{weekData.resumen.nota}</p>
                  ) : null}
                </div>
              ) : null}

              {dias.map((dia) => {
                const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                if (!sessions.length) return null
                return (
                  <article key={dia.nombre} className={`rounded-xl border ${coachBorder} overflow-hidden ${coachBg.card}`}>
                    <div className="px-4 py-3 bg-[#6A1F6D] text-white">
                      <span className="text-sm font-bold uppercase tracking-widest">{dia.nombre}</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {sessions.map(({ label, color, key }) => (
                        <div key={key} className={`rounded-xl p-4 border ${coachBorder} ${coachBg.cardMuted}`}>
                          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color }}>
                            {label}
                          </p>
                          <CoachFormattedSession text={dia[key]} accentColor={color || '#6A1F6D'} />
                        </div>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className={`text-sm ${coachText.muted}`}>No hay datos completos para esta entrada.</p>
          )}
        </>
      )}
    </section>
  )
}
