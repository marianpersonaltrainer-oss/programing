import { randomUUID } from 'node:crypto'
import { createHeadCoachQueueBroker, HeadCoachQueueBrokerError } from './lib/headCoachQueueBroker.js'
import { isHeadCoachWorkerAuthorized } from './lib/headCoachWorkerAuth.js'

export function createHeadCoachWorkerClaimHandler({
  authorizeImpl = isHeadCoachWorkerAuthorized,
  broker = createHeadCoachQueueBroker(),
  requestIdImpl = randomUUID,
} = {}) {
  return async function headCoachWorkerClaimHandler(req, res) {
    const requestId = requestIdImpl()
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed', requestId })
    if (!authorizeImpl(req)) return res.status(401).json({ error: 'worker_unauthorized', requestId })
    try {
      const question = await broker.claim()
      return res.status(200).json({ ok: true, question, requestId })
    } catch (error) {
      const code = error instanceof HeadCoachQueueBrokerError ? error.code : 'claim_unavailable'
      return res.status(503).json({ error: code, requestId })
    }
  }
}

export default createHeadCoachWorkerClaimHandler()
