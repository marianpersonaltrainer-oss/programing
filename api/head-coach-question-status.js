import { randomUUID } from 'node:crypto'
import { capabilityAuthErrorResponse, requireEvoCapability } from './lib/evoCapabilityAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import { createHeadCoachQueueBroker, HeadCoachQueueBrokerError } from './lib/headCoachQueueBroker.js'

export function createHeadCoachQuestionStatusHandler({
  requireCapabilityImpl = requireEvoCapability,
  broker = createHeadCoachQueueBroker(),
  requestIdImpl = randomUUID,
} = {}) {
  return async function headCoachQuestionStatusHandler(req, res) {
    const requestId = requestIdImpl()
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed', requestId })
    const origin = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !origin) && !isEvoOriginAllowed(origin)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }
    let authorization
    try {
      authorization = await requireCapabilityImpl(req, 'coach.workspace.access')
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }
    try {
      const result = await broker.status({
        ticket: req.query?.ticket,
        organizationId: authorization.organizationId,
        requesterUserId: authorization.user.id,
      })
      if (!result) return res.status(404).json({ error: 'ticket_not_found', requestId })
      return res.status(200).json({ ok: true, result, requestId })
    } catch (error) {
      const code = error instanceof HeadCoachQueueBrokerError ? error.code : 'status_unavailable'
      const status = code === 'invalid_ticket' ? 400 : 503
      return res.status(status).json({ error: code, requestId })
    }
  }
}

export default createHeadCoachQuestionStatusHandler()
