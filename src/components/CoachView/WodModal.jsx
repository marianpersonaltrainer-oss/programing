import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { findVideosInProgramTextResolved } from '../../utils/coachLibraryVideoMatch.js'
import CoachFormattedSession from './CoachFormattedSession.jsx'
import { CoachSessionBriefingModalBody } from './CoachSessionBriefing.jsx'
import { classDisplayTitle } from './coachTheme.js'

function youtubeVideoId(url) {
  const s = String(url || '')
  const m = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/i)
  return m ? m[1] : null
}

/**
 * Modal a pantalla completa, fondo blanco (WodBuster-style).
 * `onConsultAssistant` recibe { dayName, classLabel, sessionText } (solo WOD); el padre cierra el modal si aplica.
 */
export default function WodModal({
  open,
  onClose,
  sessionKey,
  classLabel,
  dayName,
  sessionText,
  sessionFeedback = '',
  dailyFeedback = null,
  accentColor,
  exerciseLibrary,
  onConsultAssistant,
}) {
  const [videosOpen, setVideosOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setVideosOpen(false)
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const videoSourceText =
    videosOpen && sessionText
      ? [sessionText, sessionFeedback].map((s) => String(s || '').trim()).filter(Boolean).join('\n')
      : ''
  const videos =
    videoSourceText ? findVideosInProgramTextResolved(videoSourceText, exerciseLibrary || []) : []

  if (!mounted || !open) return null

  const titleUpper = classDisplayTitle(sessionKey)
  const dayUpper = String(dayName || '').toUpperCase()

  const node = (
    <div
      className="fixed inset-0 z-[180] flex flex-col bg-white text-[#1a1a1a] font-evo-body"
      role="dialog"
      aria-modal="true"
      aria-label={`WOD ${classLabel}`}
    >
      <div className="flex-shrink-0 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={onClose}
          className="p-3 rounded-xl text-[#1a1a1a] hover:bg-neutral-100 text-2xl leading-none font-light"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h2
          className="font-evo-display font-bold text-[18px] uppercase tracking-tight mb-2"
          style={{ color: accentColor }}
        >
          {titleUpper} · {dayUpper}
        </h2>

        {dailyFeedback?.note ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Feedback de hoy</p>
            {dailyFeedback?.meta ? <p className="text-[11px] text-amber-700/90 mt-0.5">{dailyFeedback.meta}</p> : null}
            <p className="text-[13px] leading-snug text-amber-900 mt-1 whitespace-pre-wrap">{dailyFeedback.note}</p>
          </div>
        ) : null}

        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Entrenamiento</p>
        <CoachFormattedSession text={sessionText} accentColor={accentColor} variant="modalProse" />

        {String(sessionFeedback || '').trim() ? (
          <>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Briefing programación</p>
            <CoachSessionBriefingModalBody text={sessionFeedback} accentColor={accentColor} />
          </>
        ) : null}

        <button
          type="button"
          onClick={() => {
            onConsultAssistant({
              dayName,
              classLabel,
              sessionText: String(sessionText || ''),
              sessionFeedbackText: String(sessionFeedback || '').trim() || undefined,
            })
          }}
          className="mt-4 mb-1 w-full max-w-xs mx-auto block py-2 px-3 rounded-lg text-[12px] font-semibold border bg-white transition-colors hover:bg-neutral-50"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          Consultar al asistente
        </button>

        <details className="mt-5 border-t border-neutral-200 pt-3" onToggle={(e) => setVideosOpen(e.currentTarget.open)}>
          <summary className="cursor-pointer list-none text-[13px] font-semibold text-[#444444] flex items-center gap-2 [&::-webkit-details-marker]:hidden">
            <span aria-hidden>▸</span>
            <span>Vídeos de referencia</span>
          </summary>
          <div className="mt-3 space-y-3 pl-1">
            {!videos.length ? (
              <p className="text-sm text-[#666666]">No hay vídeos enlazados para esta sesión.</p>
            ) : (
              videos.map(({ name, url }) => {
                const id = youtubeVideoId(url)
                return (
                  <a
                    key={`${name}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-lg border border-neutral-200 overflow-hidden hover:border-neutral-400 transition-colors"
                  >
                    {id ? (
                      <img
                        src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
                        alt=""
                        className="w-28 h-20 object-cover shrink-0 bg-neutral-100"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-28 h-20 shrink-0 bg-neutral-100 flex items-center justify-center text-xs text-neutral-500">
                        ▶
                      </div>
                    )}
                    <span className="py-2 pr-2 text-sm font-semibold text-[#1a1a1a] leading-snug self-center">{name}</span>
                  </a>
                )
              })
            )}
          </div>
        </details>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
