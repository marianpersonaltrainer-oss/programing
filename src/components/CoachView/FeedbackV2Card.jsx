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
      <div className="rounded-xl bg-gray-50/90 px-4 py-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{plainText}</p>
      </div>
    )
  }

  if (!parsed || typeof parsed !== 'object') return null

  const objetivo = String(parsed.objetivo || '').trim()
  const sensaciones = String(parsed.sensaciones || '').trim()
  const anticipacion = String(parsed.anticipacion || '').trim()

  if (!objetivo && !sensaciones && !anticipacion) return null

  return (
    <div className="rounded-xl bg-gray-50/90 px-4 py-3 space-y-3">
      {objetivo ? (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">OBJETIVO</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{objetivo}</p>
        </section>
      ) : null}
      {sensaciones ? (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">SENSACIONES</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{sensaciones}</p>
        </section>
      ) : null}
      {anticipacion ? (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">ANTICIPACIÓN</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{anticipacion}</p>
        </section>
      ) : null}
    </div>
  )
}
