import { evoBrand } from '../../constants/evoBrand.js'
import {
  PE2_PATTERN_LABELS,
  PE2_SESSION_STATUS_LABELS,
} from './pe2Slot.js'

const STATUS_STYLE = {
  empty: { bg: evoBrand.cardAlt, border: `${evoBrand.purple}22`, dot: evoBrand.muted },
  ai_draft: { bg: '#FFF8E6', border: '#E6913844', dot: '#E69138' },
  confirmed: { bg: '#E8F5EC', border: '#1F8A4C44', dot: '#1F8A4C' },
}

function sortBlocks(blocks) {
  const order = { warmup: 0, A: 1, B: 2, C: 3 }
  return [...(blocks || [])].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.sort_order - b.sort_order)
}

function blockSummary(block) {
  const items = [...(block.items || [])].sort((a, b) => a.sort_order - b.sort_order)
  const first = items[0]
  const label = block.name || block.kind
  if (!first) return `${label}: —`
  const text = first.exercise?.name || first.raw_text || '—'
  const extra = items.length > 1 ? ` +${items.length - 1}` : ''
  return `${label}: ${text}${extra}`
}

export default function SessionCell({ session, empty = false }) {
  if (empty || !session) {
    return (
      <div
        className="h-full min-h-[108px] rounded-xl border border-dashed flex items-center justify-center p-2"
        style={{ borderColor: `${evoBrand.purple}33`, backgroundColor: evoBrand.cardAlt }}
      >
        <span className="text-[11px]" style={{ color: evoBrand.muted }}>—</span>
      </div>
    )
  }

  const st = STATUS_STYLE[session.status] || STATUS_STYLE.empty
  const blocks = sortBlocks(session.blocks).filter((b) => b.kind !== 'warmup').slice(0, 3)
  const pattern = session.dominant_pattern
    ? PE2_PATTERN_LABELS[session.dominant_pattern] || session.dominant_pattern
    : null

  return (
    <div
      className="h-full min-h-[108px] rounded-xl border p-2.5 flex flex-col gap-1.5 text-left"
      style={{ backgroundColor: st.bg, borderColor: st.border }}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <p className="text-[11px] font-bold leading-snug truncate" style={{ color: evoBrand.text }}>
          {session.title || 'Sesión'}
        </p>
        <span
          className="flex-shrink-0 w-2 h-2 rounded-full mt-1"
          style={{ backgroundColor: st.dot }}
          title={PE2_SESSION_STATUS_LABELS[session.status] || session.status}
        />
      </div>

      {pattern ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: evoBrand.purple }}>
          {pattern}
        </p>
      ) : (
        <p className="text-[10px]" style={{ color: evoBrand.muted }}>
          Sin patrón
        </p>
      )}

      <p className="text-[10px]" style={{ color: evoBrand.muted }}>
        {PE2_SESSION_STATUS_LABELS[session.status] || session.status}
        {session.est_minutes ? ` · ~${session.est_minutes}′` : ''}
      </p>

      {blocks.length > 0 ? (
        <ul className="mt-auto space-y-0.5">
          {blocks.map((b) => (
            <li key={b.id} className="text-[10px] leading-snug truncate" style={{ color: evoBrand.text }}>
              {blockSummary(b)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
