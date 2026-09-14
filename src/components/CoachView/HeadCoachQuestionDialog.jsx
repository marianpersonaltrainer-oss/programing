import { useEffect, useState } from 'react'
import {
  explainHeadCoachGatewayError,
  getHeadCoachQuestionStatus,
  isHeadCoachGatewayEnabled,
  submitHeadCoachQuestion,
} from '../../lib/headCoachGateway.js'

const MAX_STATUS_CHECKS = 8
const STATUS_CHECK_DELAY_MS = 3000

function cleanContext(context) {
  return {
    dayName: String(context?.dayName || '').trim(),
    classLabel: String(context?.classLabel || '').trim(),
    sessionText: String(context?.sessionText || '').trim(),
  }
}

/**
 * Entrada mínima al Head Coach. Queda apagada hasta que Preview disponga de
 * una base aislada y nunca usa el asistente Anthropic existente.
 */
export default function HeadCoachQuestionDialog({ context, onClose }) {
  const [question, setQuestion] = useState('')
  const [ticket, setTicket] = useState('')
  const [status, setStatus] = useState('idle')
  const [answer, setAnswer] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const enabled = isHeadCoachGatewayEnabled()

  useEffect(() => {
    if (!ticket || status !== 'waiting') return undefined
    let cancelled = false
    let checks = 0
    let timerId

    const check = async () => {
      try {
        const result = await getHeadCoachQuestionStatus({ ticket })
        if (cancelled) return
        if (result?.status === 'answered') {
          setAnswer(String(result?.response || '').trim())
          setStatus('answered')
          return
        }
        if (result?.status === 'failed' || result?.status === 'expired') {
          setErrorCode('head_coach_gateway_unavailable')
          setStatus('error')
          return
        }
        checks += 1
        if (checks >= MAX_STATUS_CHECKS) {
          setErrorCode('status_unavailable')
          setStatus('error')
          return
        }
        timerId = window.setTimeout(check, STATUS_CHECK_DELAY_MS)
      } catch (error) {
        if (!cancelled) {
          setErrorCode(error?.code || 'status_unavailable')
          setStatus('error')
        }
      }
    }

    timerId = window.setTimeout(check, STATUS_CHECK_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [ticket, status])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!question.trim() || status === 'sending' || status === 'waiting') return
    if (!enabled) {
      setErrorCode('head_coach_gateway_not_configured')
      return
    }
    setErrorCode('')
    setAnswer('')
    setStatus('sending')
    try {
      const nextTicket = await submitHeadCoachQuestion({
        question: question.trim(),
        context: cleanContext(context),
      })
      setTicket(nextTicket)
      setStatus('waiting')
    } catch (error) {
      setErrorCode(error?.code || 'head_coach_gateway_unavailable')
      setStatus('error')
    }
  }

  const busy = status === 'sending' || status === 'waiting'

  return (
    <div className="fixed inset-0 z-[190] flex items-end bg-black/70 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Pregunta al Head Coach">
      <div className="w-full max-w-lg rounded-2xl border border-[#A729AD]/60 bg-[#1A0F1B] p-6 shadow-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFFF4C]">Head Coach</p>
        <h2 className="mt-2 font-evo-display text-2xl font-bold text-[#F6E8F9]">Duda sobre esta clase</h2>
        <p className="mt-2 text-sm text-[#F6E8F9]/65">{context?.dayName} · {context?.classLabel}</p>
        <p className="mt-4 text-sm leading-relaxed text-[#F6E8F9]/75">
          Pregunta sobre cómo explicar, organizar o impartir la clase. Esta primera vía no acepta nombres, situaciones de salud ni cambios en la programación.
        </p>

        {!enabled ? (
          <div className="mt-5 rounded-xl border border-[#F6E8F9]/15 bg-[#0C0B0C] p-4">
            <p className="text-sm leading-relaxed text-[#F6E8F9]/75">
              La conexión privada está en preparación. No se guardará ni enviará ninguna duda desde esta pantalla hasta que esté lista la base de pruebas.
            </p>
          </div>
        ) : answer ? (
          <div className="mt-5 rounded-xl border border-[#FFFF4C]/45 bg-[#0C0B0C] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFFF4C]">Respuesta del Head Coach</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#F6E8F9]">{answer}</p>
          </div>
        ) : (
          <form className="mt-5" onSubmit={handleSubmit}>
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#F6E8F9]/65" htmlFor="head-coach-question">Tu duda</label>
            <textarea
              id="head-coach-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={800}
              rows={4}
              placeholder="Ej.: ¿Cómo explico el objetivo del bloque A al grupo?"
              className="mt-2 w-full resize-none rounded-xl border border-[#F6E8F9]/25 bg-[#0C0B0C] px-3 py-3 text-sm text-[#F6E8F9] outline-none placeholder:text-[#F6E8F9]/35 focus:border-[#A729AD]"
            />
            {errorCode ? <p className="mt-3 text-sm text-[#FFFF4C]">{explainHeadCoachGatewayError(errorCode)}</p> : null}
            {busy ? <p className="mt-3 text-sm text-[#F6E8F9]/70">{status === 'sending' ? 'Enviando la duda…' : 'Head Coach está preparando la respuesta…'}</p> : null}
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="mt-4 w-full rounded-xl bg-[#A729AD] px-4 py-3 text-sm font-bold text-white transition-colors enabled:hover:bg-[#8e2294] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Preguntar al Head Coach
            </button>
          </form>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl border border-[#F6E8F9]/35 px-4 py-3 text-sm font-bold text-[#F6E8F9] hover:border-[#F6E8F9]/70">
          {answer || !enabled ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </div>
  )
}
