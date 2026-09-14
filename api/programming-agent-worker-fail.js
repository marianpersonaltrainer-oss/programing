import { randomUUID } from 'node:crypto'
import {
  createProgrammingAgentVpsQueueBroker,
  ProgrammingAgentVpsQueueError,
} from './lib/programmingAgentVpsQueue.js'
import { isProgrammingAgentWorkerAuthorized } from './lib/programmingAgentWorkerAuth.js'

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch {
    return null
  }
}

export function createProgrammingAgentWorkerFailHandler({
  authorizeImpl = isProgrammingAgentWorkerAuthorized,
  broker = createProgrammingAgentVpsQueueBroker(),
  requestIdImpl = randomUUID,
} = {}) {
  return async function programmingAgentWorkerFailHandler(req, res) {
    const requestId = requestIdImpl()
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed', requestId })
    if (!authorizeImpl(req)) return res.status(401).json({ error: 'worker_unauthorized', requestId })
    const body = parseBody(req)
    if (!body) return res.status(400).json({ error: 'invalid_json', requestId })
    try {
      const result = await broker.fail(body)
      return res.status(200).json({ ok: true, result, requestId })
    } catch (error) {
      const code = error instanceof ProgrammingAgentVpsQueueError ? error.code : 'failure_unavailable'
      return res.status(code === 'invalid_failure' ? 400 : code === 'ticket_unavailable' ? 409 : 503)
        .json({ error: code, requestId })
    }
  }
}

export default createProgrammingAgentWorkerFailHandler()
