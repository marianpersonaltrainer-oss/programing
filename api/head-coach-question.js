import {
  capabilityAuthErrorResponse,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  createHeadCoachQuestion,
  HeadCoachQuestionError,
} from '../src/domain/coach/headCoachQuestion.js'

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch {
    return null
  }
}

/**
 * Puerta deliberadamente incompleta del Head Coach propio.
 * Verifica origen, identidad y el contrato antes de que exista una conexión
 * con el servidor. Nunca recurre a /api/anthropic.
 */
export function createHeadCoachQuestionHandler({
  requireCapabilityImpl = requireEvoCapability,
  dispatchImpl = null,
  requestIdImpl = () => crypto.randomUUID(),
} = {}) {
  return async function headCoachQuestionHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed', requestId })

    const origin = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !origin) && !isEvoOriginAllowed(origin)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }

    const body = parseBody(req)
    if (!body) return res.status(400).json({ error: 'invalid_json', requestId })

    try {
      await requireCapabilityImpl(req, 'coach.workspace.access')
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }

    let envelope
    try {
      envelope = createHeadCoachQuestion(body)
    } catch (error) {
      if (error instanceof HeadCoachQuestionError) {
        return res.status(400).json({ error: error.code, requestId })
      }
      return res.status(400).json({ error: 'invalid_question', requestId })
    }

    if (typeof dispatchImpl !== 'function') {
      return res.status(503).json({ error: 'head_coach_gateway_not_configured', requestId })
    }

    try {
      const result = await dispatchImpl(envelope)
      return res.status(202).json({ ok: true, status: 'accepted', requestId, result })
    } catch {
      return res.status(503).json({ error: 'head_coach_gateway_unavailable', requestId })
    }
  }
}

export default createHeadCoachQuestionHandler()
