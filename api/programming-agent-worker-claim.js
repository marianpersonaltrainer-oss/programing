import { randomUUID } from 'node:crypto'
import {
  createProgrammingAgentVpsQueueBroker,
  ProgrammingAgentVpsQueueError,
} from './lib/programmingAgentVpsQueue.js'
import { isProgrammingAgentWorkerAuthorized } from './lib/programmingAgentWorkerAuth.js'

export function createProgrammingAgentWorkerClaimHandler({
  authorizeImpl = isProgrammingAgentWorkerAuthorized,
  broker = createProgrammingAgentVpsQueueBroker(),
  requestIdImpl = randomUUID,
} = {}) {
  return async function programmingAgentWorkerClaimHandler(req, res) {
    const requestId = requestIdImpl()
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed', requestId })
    if (!authorizeImpl(req)) return res.status(401).json({ error: 'worker_unauthorized', requestId })
    try {
      const request = await broker.claim()
      return res.status(200).json({ ok: true, request, requestId })
    } catch (error) {
      const code = error instanceof ProgrammingAgentVpsQueueError ? error.code : 'claim_unavailable'
      return res.status(503).json({ error: code, requestId })
    }
  }
}

export default createProgrammingAgentWorkerClaimHandler()
