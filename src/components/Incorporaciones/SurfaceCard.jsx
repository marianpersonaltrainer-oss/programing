import Icon from './Icons.jsx'
import StatusBadge from './StatusBadge.jsx'

export default function SurfaceCard({ eyebrow, title, detail, status, statusLabel, onOpen, children }) {
  return (
    <article className="rounded-[1.4rem] border border-white/10 bg-[#1A101B] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-base font-bold text-[#C86CCE]">{eyebrow}</p>}
          <h3 className="font-evo-display text-xl font-semibold tracking-wide text-white">{title}</h3>
          {detail && <p className="mt-1 text-base leading-7 text-[#F6E8F9]/65">{detail}</p>}
        </div>
        {status && <StatusBadge status={status}>{statusLabel}</StatusBadge>}
      </div>
      {children}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-4 flex min-h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 text-base font-bold text-white transition hover:border-[#A729AD]/70 hover:bg-[#A729AD]/15 focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70"
        >
          Abrir alta ficticia
          <Icon name="arrow" className="h-4 w-4 text-[#FFFF4C]" />
        </button>
      )}
    </article>
  )
}
