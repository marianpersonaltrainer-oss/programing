import { randomUUID } from 'node:crypto'
import { createHeadCoachQueueBroker, HeadCoachQueueBrokerError } from './lib/headCoachQueueBroker.js'
import { isHeadCoachWorkerAuthorized } from './lib/headCoachWorkerAuth.js'

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
}

/**
 * Closes a claimed request that the VPS deliberately declines to process.
 * It only stores a fixed-safe failure code; it never returns class context.
 */
export function createHeadCoachWorkerFailHandler({
  authorizeImpl = isHeadCoachWorkerAuthorized,
  broker = createHeadCoachQueueBroker(),
  requestIdImpl = randomUUID,
} = {}) {
  return async function headCoachWorkerFailHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed', requestId })
    if (!authorizeImpl(req)) return res.status(401).json({ error: 'worker_unauthorized', requestId })
    try {
      const { ticket, errorCode } = parseBody(req)
      const result = await broker.fail({ ticket, errorCode })
      return res.status(200).json({ ok: true, result, requestId })
    } catch (error) {
      const code = error instanceof HeadCoachQueueBrokerError ? error.code : 'failure_unavailable'
      return res.status(code === 'invalid_failure' ? 400 : 503).json({ error: code, requestId })
    }
  }
}

export default createHeadCoachWorkerFailHandler()
