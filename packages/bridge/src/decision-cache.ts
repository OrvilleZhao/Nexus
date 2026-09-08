import type { DecisionCacheKey, PolicyDecision } from '@nexus/core'

interface CacheEntry {
  decision: PolicyDecision
  cachedAt: number
}

export interface DecisionCacheOptions {
  clock?: () => number
}

export class DecisionCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly clock: () => number

  constructor(opts: DecisionCacheOptions = {}) {
    this.clock = opts.clock ?? (() => Date.now())
  }

  get(key: DecisionCacheKey): PolicyDecision | undefined {
    const k = cacheKeyString(key)
    const entry = this.entries.get(k)
    if (entry === undefined) return undefined
    if (this.clock() - entry.cachedAt >= entry.decision.ttl_seconds * 1000) {
      this.entries.delete(k)
      return undefined
    }
    return entry.decision
  }

  set(key: DecisionCacheKey, decision: PolicyDecision): void {
    if (decision.ttl_seconds <= 0 || decision.decision === 'pause') return
    this.entries.set(cacheKeyString(key), { decision, cachedAt: this.clock() })
  }

  clear(): void {
    this.entries.clear()
  }

  get size(): number {
    return this.entries.size
  }
}

function cacheKeyString(key: DecisionCacheKey): string {
  return `${key.policy_version}\u0000${key.subject_hash}\u0000${key.action_tool}\u0000${key.resource_hash}`
}
