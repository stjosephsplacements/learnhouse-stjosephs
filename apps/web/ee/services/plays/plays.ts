// Learner read of a play. The ported playground service serves both authoring and viewing;
// anonymous visitors have no token, so a missing session is reported as "not found".
import { getPlayground } from './playgrounds'

export async function getPlayForLearner(playgroundUuid: string, access_token?: string): Promise<any> {
  if (!access_token) throw Object.assign(new Error('Sign in to open this play'), { status: 404 })
  return getPlayground(playgroundUuid, access_token)
}
