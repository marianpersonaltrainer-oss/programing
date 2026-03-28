import { findVideosForPublishedDay } from '../../constants/exerciseVideos.js'
import { SESSION_BLOCKS, FEEDBACK_BLOCKS } from './coachViewConstants.js'
import { findDia, sessionText, previewText, buildDayQuickSummary } from './coachViewUtils.js'

function CoachVideoChips({ videos, title = 'Vídeos rápidos', subtitle }) {
  if (!videos?.length) {
    return (
      <div className="rounded-2xl p-4 bg-gray-50/90 border border-black/6">
        <p className="text-[9px] font-bold text-evo-muted uppercase tracking-widest mb-1">{title}</p>
        <p className="text-[10px] text-evo-muted leading-relaxed">
          {subtitle ||
            'No hay coincidencias con la biblioteca de ejercicios en este día. Usa el asistente o busca en YouTube el nombre del movimiento.'}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-red-50 via-white to-amber-50/30 border border-red-100/70 shadow-sm">
      <p className="text-[9px] font-bold text-red-900 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-[10px] text-red-900/65 mb-3 leading-snug">
        Abre YouTube con una búsqueda ya orientada a técnica. Todo dentro de la app; vuelve con el botón atrás del navegador.
      </p>
      <div className="flex flex-wrap gap-2">
        {videos.map(({ name, url }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-xl bg-[#FF0000] text-white hover:bg-[#cc0000] shadow-md shadow-red-500/20 active:scale-[0.97] transition-transform"
          >
            <span className="text-xs leading-none opacity-95" aria-hidden>
              ▶
            </span>
            <span className="max-w-[10rem] truncate normal-case">{name}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

/**
 * Vista semanal publicada (días, Excel, vídeos, detalle día).
 * onOpenSupport: abre pestaña Soporte; si se pasa texto, rellena el input del chat.
 */
export default function CoachWeekProgrammingPanel({ weekData, activeDay, setActiveDay, weekTab, setWeekTab, onOpenSupport }) {
  const dias = weekData?.dias || []

  const ask = (text) => {
    onOpenSupport(text)
    setActiveDay('show')
    setWeekTab('dias')
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain border-b border-black/5 bg-gray-50/50 relative z-10">
      {weekData?.resumen && (
        <div className="px-5 py-4 border-b border-black/5 bg-indigo-50/30">
          <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5">Orientación Semanal</p>
          <p className="text-[11px] text-evo-text font-bold leading-tight uppercase tracking-tight">
            {weekData.resumen.estimulo} · {weekData.resumen.intensidad}
            {weekData.resumen.foco ? ` · ${weekData.resumen.foco}` : ''}
          </p>
          <p className="text-[10px] text-evo-muted font-medium mt-1 leading-relaxed">{weekData.resumen.nota}</p>
        </div>
      )}

      {activeDay === 'show' && (
        <>
          <div className="flex gap-2 px-5 pt-3 pb-2 border-b border-black/5 bg-white/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setWeekTab('dias')}
              className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all shrink-0 ${
                weekTab === 'dias' ? 'bg-evo-accent text-white' : 'bg-gray-100 text-evo-muted hover:text-evo-text'
              }`}
            >
              Por día + resumen
            </button>
            <button
              type="button"
              onClick={() => setWeekTab('excel')}
              className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all shrink-0 ${
                weekTab === 'excel' ? 'bg-evo-accent text-white' : 'bg-gray-100 text-evo-muted hover:text-evo-text'
              }`}
            >
              Vista completa (tipo Excel)
            </button>
            <button
              type="button"
              onClick={() => setWeekTab('videos')}
              className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all shrink-0 ${
                weekTab === 'videos' ? 'bg-evo-accent text-white' : 'bg-gray-100 text-evo-muted hover:text-evo-text'
              }`}
            >
              Vídeos por día
            </button>
          </div>

          {weekTab === 'dias' && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest">
                Toca un día: resumen rápido y detalle. Pestaña Soporte para preguntas al asistente.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {dias.map((dia) => {
                  const { labels, preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
                  const videoCount = findVideosForPublishedDay(dia).length
                  return (
                    <button
                      key={dia.nombre}
                      type="button"
                      onClick={() => setActiveDay(dia.nombre)}
                      className="text-left rounded-2xl p-4 bg-white border border-black/8 shadow-sm hover:border-evo-accent/35 hover:shadow-md transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[11px] font-bold text-evo-text uppercase tracking-tight">{dia.nombre}</p>
                        {videoCount > 0 && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg shrink-0">
                            ▶ {videoCount} vídeo{videoCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {labels.length ? (
                          labels.map((lb) => (
                            <span
                              key={lb}
                              className="text-[9px] px-2 py-0.5 rounded-md bg-gray-100 text-evo-muted font-bold uppercase tracking-wide"
                            >
                              {lb}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-amber-700 font-bold uppercase">Sin bloques de sesión en datos</span>
                        )}
                      </div>
                      {preview ? (
                        <pre className="text-[10px] text-gray-500 font-medium whitespace-pre-wrap leading-relaxed line-clamp-6 font-sans">
                          {preview}
                        </pre>
                      ) : sessionText(dia.wodbuster) ? (
                        <pre className="text-[10px] text-emerald-800/80 font-medium whitespace-pre-wrap leading-relaxed line-clamp-5 font-sans">
                          {previewText(dia.wodbuster, 8, 400)}
                        </pre>
                      ) : null}
                      <p className="text-[9px] text-evo-accent font-bold uppercase tracking-widest mt-2">Ver detalle →</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {weekTab === 'videos' && (
            <div className="px-5 py-4 space-y-5 pb-6">
              <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest leading-relaxed">
                Ejercicios detectados en la programación publicada (biblioteca EVO). Agrupados por día: un toque y abres YouTube con la búsqueda lista.
              </p>
              {dias.map((dia) => {
                const vids = findVideosForPublishedDay(dia)
                return (
                  <div key={dia.nombre} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 px-0.5">
                      <p className="text-[11px] font-bold text-evo-text uppercase tracking-widest">{dia.nombre}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setWeekTab('dias')
                          setActiveDay(dia.nombre)
                        }}
                        className="text-[9px] font-bold text-evo-accent uppercase tracking-wide underline decoration-evo-accent/30"
                      >
                        Ver texto del día
                      </button>
                    </div>
                    <CoachVideoChips
                      videos={vids}
                      title={vids.length ? `Vídeos · ${dia.nombre}` : `Sin vídeos detectados · ${dia.nombre}`}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {weekTab === 'excel' && (
            <div className="px-5 py-4 space-y-4 pb-6">
              <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest">
                Misma información que en el Excel publicado: todas las sesiones por día. Desplázate para leer.
              </p>
              {dias.map((dia) => {
                const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                const feedbacks = FEEDBACK_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                const wb = sessionText(dia.wodbuster)
                return (
                  <div key={dia.nombre} className="rounded-2xl border border-black/8 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-900 text-white flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-widest">{dia.nombre}</span>
                      <button
                        type="button"
                        onClick={() => ask(`Tengo una duda sobre la programación del ${dia.nombre}: `)}
                        className="text-[9px] font-bold uppercase tracking-widest text-white/90 underline decoration-white/40"
                      >
                        Preguntar este día
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      {sessions.map(({ label, color, key }) => (
                        <div key={key} className="rounded-xl p-3 bg-gray-50/80 border border-black/5">
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color }}>
                            {label}
                          </p>
                          <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                        </div>
                      ))}
                      {feedbacks.map(({ label, key }) => (
                        <div key={key} className="rounded-xl p-3 bg-indigo-50/50 border border-indigo-100/60">
                          <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest mb-1.5">{label}</p>
                          <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                        </div>
                      ))}
                      {wb && (
                        <div className="rounded-xl p-3 bg-emerald-50/40 border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-1.5">WodBuster / alumno</p>
                          <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia.wodbuster}</pre>
                        </div>
                      )}
                      {!sessions.length && !feedbacks.length && !wb && (
                        <p className="text-[11px] text-evo-muted">Sin contenido para este día.</p>
                      )}
                      <div className="pt-2 border-t border-black/5">
                        <CoachVideoChips videos={findVideosForPublishedDay(dia)} title={`▶ Vídeos · ${dia.nombre}`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeDay !== 'show' && activeDay != null && (
        <div className="border-t border-black/5">
          <div className="px-5 py-3 flex flex-wrap items-center gap-2 bg-white/70 sticky top-0 z-[1] border-b border-black/5">
            <button
              type="button"
              onClick={() => {
                setActiveDay('show')
                setWeekTab('dias')
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-evo-accent border border-evo-accent/30 px-3 py-1.5 rounded-lg hover:bg-evo-accent/5"
            >
              ← Volver a días
            </button>
            <span className="text-[11px] font-bold text-evo-text uppercase tracking-tight">{activeDay}</span>
          </div>
          {(() => {
            const dia = findDia(dias, activeDay)
            if (!dia) {
              return (
                <div className="px-5 py-5">
                  <p className="text-[11px] text-evo-muted font-medium">No hay datos para este día en la semana publicada.</p>
                </div>
              )
            }
            const { labels, preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
            const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
            const feedbacks = FEEDBACK_BLOCKS.filter(({ key }) => sessionText(dia[key]))
            const wb = sessionText(dia.wodbuster)
            const hasAny = sessions.length > 0 || feedbacks.length > 0 || wb
            const dayName = dia.nombre
            const dayVideos = findVideosForPublishedDay(dia)

            return (
              <div className="px-5 pb-6 pt-3 space-y-4">
                <CoachVideoChips
                  videos={dayVideos}
                  title={`Vídeos del ${dayName}`}
                  subtitle={`Nada en biblioteca para el ${dayName}. Pregunta en Soporte: «¿cómo es la técnica de…?»`}
                />

                <div className="rounded-2xl p-4 bg-gradient-to-br from-evo-accent/8 to-purple-50/40 border border-evo-accent/15">
                  <p className="text-[9px] font-bold text-evo-accent uppercase tracking-widest mb-2">Resumen rápido</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {labels.map((lb) => (
                      <span key={lb} className="text-[9px] px-2 py-0.5 rounded-md bg-white/80 border border-black/5 font-bold text-evo-text uppercase">
                        {lb}
                      </span>
                    ))}
                  </div>
                  {preview ? (
                    <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{preview}</pre>
                  ) : (
                    <p className="text-[11px] text-evo-muted">Sin extracto: baja a la vista detallada o usa los botones para preguntar.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      ask(`Tengo una duda sobre la programación del ${dayName}: ¿puedes orientarme con tiempos y escalado?`)
                    }
                    className="text-[10px] px-3 py-2 rounded-xl bg-evo-accent text-white font-bold uppercase tracking-widest shadow-sm hover:bg-evo-accent-hover active:scale-[0.98]"
                  >
                    Preguntar por {dayName}
                  </button>
                  <button
                    type="button"
                    onClick={() => ask(`Sobre el ${dayName}: ¿qué harías si tengo poco tiempo o falta material en sala?`)}
                    className="text-[10px] px-3 py-2 rounded-xl bg-white border border-black/10 text-evo-text font-bold uppercase tracking-widest hover:bg-gray-50"
                  >
                    Plan B / poco tiempo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      ask(`En el ${dayName}, ¿cómo escalarías el WOD para nivel principiante manteniendo el estímulo?`)
                    }
                    className="text-[10px] px-3 py-2 rounded-xl bg-white border border-black/10 text-evo-text font-bold uppercase tracking-widest hover:bg-gray-50"
                  >
                    Escalado principiantes
                  </button>
                </div>

                <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest">Detalle completo (como en Excel)</p>
                <div className="space-y-3">
                  {sessions.map(({ label, color, key }) => (
                    <div key={key} className="rounded-2xl p-4 bg-white border border-black/5 shadow-soft">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                          {label}
                        </p>
                        <button
                          type="button"
                          onClick={() => ask(`Sobre ${dayName} · ${label}: tengo una duda concreta: `)}
                          className="text-[9px] font-bold text-evo-accent uppercase tracking-wide shrink-0 underline decoration-evo-accent/30"
                        >
                          Preguntar esta clase
                        </button>
                      </div>
                      <pre className="text-[11px] text-gray-600 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                    </div>
                  ))}
                  {feedbacks.map(({ label, key }) => (
                    <div key={key} className="rounded-2xl p-4 bg-indigo-50/40 border border-indigo-100/80 shadow-soft">
                      <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-2">{label}</p>
                      <pre className="text-[11px] text-gray-600 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                    </div>
                  ))}
                  {!hasAny && (
                    <p className="text-[11px] text-evo-muted font-medium leading-relaxed">
                      Este día no tiene bloques de sesión en los datos publicados. Pide al programador que vuelva a publicar la semana o revisa el JSON.
                    </p>
                  )}
                  {wb && (
                    <div className="rounded-2xl p-4 bg-emerald-50/30 border border-emerald-100/80 shadow-soft">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-2">Vista alumno (WodBuster)</p>
                      <pre className="text-[11px] text-gray-600 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia.wodbuster}</pre>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
