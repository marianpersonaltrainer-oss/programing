import {
  getPe2Identity,
  getPe2Session,
  identityHasCapability,
} from './pe2Auth.js'

export async function hasIndividualCoachAccess({
  getSessionImpl = getPe2Session,
  getIdentityImpl = getPe2Identity,
  hasCapabilityImpl = identityHasCapability,
} = {}) {
  const session = await getSessionImpl()
  const userId = session?.user?.id
  if (!userId) return false

  const identity = await getIdentityImpl(userId)
  return hasCapabilityImpl(identity, 'coach.workspace.access')
}
