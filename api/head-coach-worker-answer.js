import { randomUUID } from 'node:crypto'
import { createHeadCoachQueueBroker, HeadCoachQueueBrokerError } from './lib/headCoachQueueBroker.js'
import { isHeadCoachWorkerAuthorized } from './lib/headCoachWorkerAuth.js'

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch {
    return null
  }
}

export function createHeadCoachWorkerAnswerHandler({
  authorizeImpl = isHeadCoachWorkerAuthorized,
  broker = createHeadCoachQueueBroker(),
  requestIdImpl = randomUUID,
} = {}) {
  return async function headCoachWorkerAnswerHandler(req, res) {
    const requestId = requestIdImpl()
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed', requestId })
    if (!authorizeImpl(req)) return res.status(401).json({ error: 'worker_unauthorized', requestId })
    const body = parseBody(req)
    if (!body) return res.status(400).json({ error: 'invalid_json', requestId })
    try {
      const result = await broker.answer(body)
      return res.status(200).json({ ok: true, result, requestId })
    } catch (error) {
      const code = error instanceof HeadCoachQueueBrokerError ? error.code : 'answer_unavailable'
      const status = code === 'invalid_answer' ? 400 : code === 'ticket_unavailable' ? 409 : 503
      return res.status(status).json({ error: code, requestId })
    }
  }
}

export default createHeadCoachWorkerAnswerHandler()
