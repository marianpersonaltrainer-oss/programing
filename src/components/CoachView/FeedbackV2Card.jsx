import { feedbackV2FromText } from '../../utils/feedbackV2Schema.js'

function normalizeFeedback(feedback) {
  if (typeof feedback === 'string') {
    const parsed = feedbackV2FromText(feedback)
    if (parsed) return { parsed, plainText: '' }
    return { parsed: null, plainText: feedback.trim() }
  }
  if (feedback && typeof feedback === 'object') {
    return { parsed: feedback, plainText: '' }
  }
  return { parsed: null, plainText: '' }
}

export default function FeedbackV2Card({ feedback }) {
  const { parsed, plainText } = normalizeFeedback(feedback)

  if (plainText) {
    return (
      <div className="rounded-[12px] bg-[#1a0f1b] border border-[#6A1F6D]/30 border-l-[3px] border-l-[#FFFF4C] px-4 py-3">
        <p className="text-sm text-[#F6E8F9] whitespace-pre-wrap leading-relaxed">{plainText}</p>
      </div>
    )
  }

  if (!parsed || typeof parsed !== 'object') return null

  const objetivo = String(parsed.objetivo || '').trim()
  const sensaciones = String(parsed.sensaciones || '').trim()
  const anticipacion = String(parsed.anticipacion || '').trim()

  if (!objetivo && !sensaciones && !anticipacion) return null

  return (
    <div className="rounded-[12px] bg-[#1a0f1b] border border-[#6A1F6D]/30 border-l-[3px] border-l-[#FFFF4C] px-4 py-3 space-y-3">
      {objetivo ? (
        <section>
          <p className="inline-flex items-center rounded-md bg-[#FFFF4C] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#0C0B0C]">
            OBJETIVO
          </p>
          <p className="mt-1 text-sm text-[#F6E8F9] leading-relaxed whitespace-pre-wrap">{objetivo}</p>
        </section>
      ) : null}
      {sensaciones ? (
        <section>
          <p className="inline-flex items-center rounded-md bg-[#FFFF4C] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#0C0B0C]">
            SENSACIONES
          </p>
          <p className="mt-1 text-sm text-[#F6E8F9] leading-relaxed whitespace-pre-wrap">{sensaciones}</p>
        </section>
      ) : null}
      {anticipacion ? (
        <section>
          <p className="inline-flex items-center rounded-md bg-[#FFFF4C] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#0C0B0C]">
            ANTICIPACIÓN
          </p>
          <p className="mt-1 text-sm text-[#F6E8F9] leading-relaxed whitespace-pre-wrap">{anticipacion}</p>
        </section>
      ) : null}
    </div>
  )
}
