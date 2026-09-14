import { adminSecretsMatch } from './evoAdminAuth.js'

export function isHeadCoachWorkerAuthorized(req, env = process.env) {
  const expected = String(env.HEAD_COACH_WORKER_SECRET || '').trim()
  const received = String(req?.headers?.['x-head-coach-worker-secret'] || '').trim()
  return Boolean(expected && received && adminSecretsMatch(received, expected))
}
