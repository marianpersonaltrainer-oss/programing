import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { extractProjectorContent } from '../../utils/extractProjectorContent.js'

export default function CoachScreenModeOverlay({ open, onClose, dayName, classLabel, sessionText }) {
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.fullscreenElement === rootRef.current) document.exitFullscreen?.().catch(() => {})
      onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return undefined
    const el = rootRef.current
    if (!el) return undefined
    const t = requestAnimationFrame(() => {
      el.requestFullscreen?.().catch(() => {})
    })
    return () => {
      cancelAnimationFrame(t)
      if (document.fullscreenElement === el) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [open])

  function handleClose() {
    if (document.fullscreenElement === rootRef.current) {
      document.exitFullscreen?.().catch(() => {})
    }
    onClose?.()
  }

  if (!open) return null

  const { headers, wod, fallback } = extractProjectorContent(sessionText)
  const body = wod || (fallback ? sessionText : '')

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Modo pantalla"
      className="fixed inset-0 z-[200] flex flex-col bg-[#0c0c0e] text-white overflow-y-auto"
      style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', lineHeight: 1.35 }}
    >
      <div className="sticky top-0 z-10 flex justify-end p-4 bg-black/50 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleClose}
          className="text-lg sm:text-xl font-black uppercase tracking-widest px-6 py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20"
        >
          Cerrar
        </button>
      </div>
      <div className="px-6 sm:px-12 pb-16 max-w-5xl mx-auto w-full space-y-10">
        <header className="space-y-2 border-b border-white/15 pb-8">
          <p className="text-white/60 text-[0.55em] font-bold uppercase tracking-[0.2em]">{dayName}</p>
          <h1 className="font-black uppercase tracking-tight text-[1.15em] leading-tight" style={{ fontSize: '1.25em' }}>
            {classLabel}
          </h1>
        </header>

        {headers.length > 0 ? (
          <section>
            <h2 className="text-[0.45em] font-bold uppercase tracking-widest text-[#c4a8e0] mb-4">Bloques</h2>
            <ul className="space-y-3 text-[0.65em] font-semibold text-white/90">
              {headers.map((h, i) => (
                <li key={i} className="border-l-4 border-[#A729AD] pl-4">
                  {h}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-[0.45em] font-bold uppercase tracking-widest text-[#c4a8e0] mb-4">
            {wod ? 'WOD / trabajo' : 'Programación'}
          </h2>
          <pre
            className="whitespace-pre-wrap font-sans font-medium text-white/95 leading-snug"
            style={{ fontSize: 'max(24px, 1em)' }}
          >
            {body}
          </pre>
        </section>
      </div>
    </div>,
    document.body,
  )
}
