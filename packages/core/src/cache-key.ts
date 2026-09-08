import { z } from 'zod'
import { sha256Hex } from './memory.js'
import type { PolicyQuery } from './policy.js'

export const DecisionCacheKeySchema = z.object({
  policy_version: z.string().min(1),
  subject_hash: z.string().regex(/^[0-9a-f]{64}$/),
  action_tool: z.string().min(1),
  resource_hash: z.string().regex(/^[0-9a-f]{64}$/)
})

export type DecisionCacheKey = z.infer<typeof DecisionCacheKeySchema>

export function makeCacheKey(query: PolicyQuery): DecisionCacheKey {
  return {
    policy_version: query.policy_version,
    subject_hash: sha256Hex(`${query.subject.name}\u0000${query.subject.session_id}`),
    action_tool: query.action.tool,
    resource_hash: sha256Hex(
      `${query.resource.type}\u0000${query.resource.path ?? ''}\u0000${query.resource.origin ?? ''}`
    )
  }
}
