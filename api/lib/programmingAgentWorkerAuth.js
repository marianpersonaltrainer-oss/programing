import { adminSecretsMatch } from './evoAdminAuth.js'

export function isProgrammingAgentWorkerAuthorized(req, env = process.env) {
  const expected = String(env.PROGRAMMING_AGENT_WORKER_SECRET || '').trim()
  const received = String(req?.headers?.['x-programming-agent-worker-secret'] || '').trim()
  return Boolean(expected && received && adminSecretsMatch(received, expected))
}
