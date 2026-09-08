import type { PolicyDecision, PolicyQuery } from './policy.js'

export interface PdpQueryOptions {
  timeoutMs?: number
}

export interface PdpClient {
  query(query: PolicyQuery, opts?: PdpQueryOptions): Promise<PolicyDecision>
}

export interface PepOutcome {
  outcome: 'execute' | 'reject' | 'pause'
  decision: PolicyDecision
}
