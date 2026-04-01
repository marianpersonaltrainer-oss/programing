import { useEffect, useRef, useState, useCallback } from 'react'

const TOAST_MS = 5000

/**
 * Toasts apilados abajo-derecha (CSS puro).
 * Ítem: { id, title?, body, variant?, actionLabel?, onAction?, onDismiss?, onConfirmRead? }
 * - variant 'handover': sin auto-cierre, sin toque en la tarjeta; solo botón «Leído ✓» (onConfirmRead opcional async).
 */
export default function CoachToastStack({ items = [], onDismissItem }) {
  return (
    <div
      className="fixed z-[200] flex flex-col gap-2 w-[min(100vw-2rem,22rem)] pointer-events-none max-md:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] max-md:right-[max(0.75rem,env(safe-area-inset-right))] md:bottom-[max(1rem,env(safe-area-inset-bottom))] md:right-[max(1rem,env(safe-area-inset-right))]"
      aria-live="polite"
    >
      {items.map((t) => (
        <CoachToast key={t.id} item={t} onDismiss={() => onDismissItem?.(t.id)} />
      ))}
    </div>
  )
}

function CoachToast({ item, onDismiss }) {
  const { title, body, actionLabel, onAction, variant } = item
  const isHandover = variant === 'handover'
  const timerRef = useRef(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const itemRef = useRef(item)
  itemRef.current = item
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  const close = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    itemRef.current?.onDismiss?.()
    onDismissRef.current?.()
  }, [])

  useEffect(() => {
    if (isHandover) return
    timerRef.current = window.setTimeout(close, TOAST_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [close, isHandover])

  async function handleHandoverRead() {
    const fn = itemRef.current?.onConfirmRead
    if (!fn) {
      close()
      return
    }
    setConfirmError('')
    setConfirming(true)
    try {
      await fn()
      close()
    } catch (e) {
      setConfirmError(e?.message || 'No se pudo guardar. Revisa conexión.')
    } finally {
      setConfirming(false)
    }
  }

  if (isHandover) {
    return (
      <div
        role="alert"
        className="pointer-events-auto text-left rounded-xl border-2 border-white/25 bg-gradient-to-br from-orange-600 via-orange-700 to-red-950 shadow-xl shadow-black/35 px-4 py-4 animate-[coachToastIn_0.28s_ease-out] ring-2 ring-orange-400/40"
      >
        <div className="flex gap-3 items-start">
          <span className="text-2xl leading-none shrink-0" aria-hidden>
            ⚠️
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            {title ? (
              <p className="text-xs font-black uppercase tracking-widest text-white/95 drop-shadow-sm">{title}</p>
            ) : null}
            <p className="text-sm font-bold text-white leading-snug drop-shadow-sm">{body}</p>
            <p className="text-[11px] font-semibold text-white/85 leading-snug">
              Lee el resumen y confirma en Feedback si hace falta. Esto queda registrado para el centro.
            </p>
            {confirmError ? (
              <p className="text-xs font-bold text-amber-200 bg-black/20 rounded-lg px-2 py-1.5">{confirmError}</p>
            ) : null}
            <button
              type="button"
              disabled={confirming}
              onClick={handleHandoverRead}
              className="mt-1 w-full py-3.5 rounded-xl bg-white text-orange-900 font-black text-sm uppercase tracking-widest shadow-lg shadow-black/20 border border-white/90 hover:bg-orange-50 disabled:opacity-60 transition-colors"
            >
              {confirming ? 'Guardando…' : 'Leído ✓'}
            </button>
          </div>
        </div>
        <style>{`
          @keyframes coachToastIn {
            from { opacity: 0; transform: translateY(10px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div
      role="alert"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          close()
        }
      }}
      tabIndex={0}
      className="pointer-events-auto text-left rounded-xl border border-black/10 bg-white shadow-lg shadow-black/15 px-4 py-3.5 animate-[coachToastIn_0.25s_ease-out] hover:bg-gray-50/95 active:scale-[0.99] transition-transform cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#A729AD]/40"
    >
      {title ? <p className="text-xs font-black uppercase tracking-wide text-[#6A1F6D] mb-1">{title}</p> : null}
      <p className="text-sm font-semibold text-[#1A0A1A] leading-snug">{body}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAction()
            close()
          }}
          className="mt-2 text-xs font-bold uppercase tracking-widest text-[#A729AD] underline decoration-[#A729AD]/40"
        >
          {actionLabel}
        </button>
      ) : null}
      <p className="text-[10px] text-gray-400 mt-2 font-medium">Toca para cerrar · se oculta solo en 5s</p>
      <style>{`
        @keyframes coachToastIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/** Hook: gestiona cola de toasts por ids estables */
export function useCoachToastQueue() {
  const [items, setItems] = useState([])
  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id))
  }, [])
  const push = useCallback((toast) => {
    setItems((prev) => {
      if (prev.some((x) => x.id === toast.id)) return prev
      return [...prev, toast]
    })
  }, [])
  return { items, push, dismiss }
}
