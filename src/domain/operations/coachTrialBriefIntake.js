const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SOURCES = new Set(['calendly', 'whatsapp'])
const FIELDS = new Set(['objective', 'experience', 'context', 'precaution', 'observe'])
const FORBIDDEN = new Set(['name', 'fullName', 'email', 'phone', 'mobile', 'address', 'payment', 'price', 'conversation', 'message', 'messages', 'whatsapp', 'diagnosis', 'medicalReport'])

export class CoachTrialBriefError extends Error { constructor(code) { super(code); this.code = code } }

function text(value, max = 500) {
  const result = typeof value === 'string' ? value.trim() : ''
  if (result.length > max) throw new CoachTrialBriefError('brief_field_too_long')
  return result
}

function assertSafe(value, path = 'brief') {
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) throw new CoachTrialBriefError(`${path}.${key}_forbidden`)
    if (nested && typeof nested === 'object') assertSafe(nested, `${path}.${key}`)
  }
}

export function normalizeCoachTrialBrief(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CoachTrialBriefError('brief_invalid')
  assertSafe(input)
  const allowed = new Set(['id', 'coachId', 'trialReference', 'sessionAt', 'classLabel', 'source', 'occurredAt', 'brief'])
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new CoachTrialBriefError('brief_field_not_allowed')
  const id = text(input.id, 240)
  const coachId = text(input.coachId, 80)
  const trialReference = text(input.trialReference, 120)
  const sessionAt = text(input.sessionAt, 80)
  const source = text(input.source, 40)
  const occurredAt = text(input.occurredAt, 80)
  if (!id || !UUID.test(coachId) || !trialReference || Number.isNaN(new Date(sessionAt).getTime()) || !SOURCES.has(source) || Number.isNaN(new Date(occurredAt).getTime())) throw new CoachTrialBriefError('brief_identity_invalid')
  if (!input.brief || typeof input.brief !== 'object' || Array.isArray(input.brief) || Object.keys(input.brief).some((key) => !FIELDS.has(key))) throw new CoachTrialBriefError('brief_payload_invalid')
  const brief = Object.fromEntries([...FIELDS].map((key) => [key, text(input.brief[key])]).filter(([, value]) => value))
  if (!Object.keys(brief).length) throw new CoachTrialBriefError('brief_empty')
  return Object.freeze({ id, coachId, trialReference, sessionAt: new Date(sessionAt).toISOString(), classLabel: text(input.classLabel, 120), source, occurredAt: new Date(occurredAt).toISOString(), brief })
}
