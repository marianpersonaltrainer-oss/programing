import { useEffect, useRef, useState, useCallback } from 'react'

const TOAST_MS = 5000

/**
 * Toasts apilados abajo-derecha (CSS puro). Cada ítem: { id, title?, body, actionLabel?, onAction?, onDismiss }
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
  const { title, body, actionLabel, onAction } = item
  const timerRef = useRef(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const itemRef = useRef(item)
  itemRef.current = item

  const close = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    itemRef.current?.onDismiss?.()
    onDismissRef.current?.()
  }, [])

  useEffect(() => {
    timerRef.current = window.setTimeout(close, TOAST_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [close])

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
