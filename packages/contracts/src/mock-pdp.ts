import type { PdpClient, PdpQueryOptions, PolicyDecision, PolicyQuery } from '@nexus/core'

export interface MockPdpScript {
  decisions?: PolicyDecision[]
  delayMs?: number
  failWith?: Error
  malformed?: unknown
}

export class MockPdp implements PdpClient {
  readonly calls: PolicyQuery[] = []
  readonly optsLog: Array<{ timeoutMs: number | undefined }> = []
  private readonly script: MockPdpScript

  constructor(script: MockPdpScript = {}) {
    this.script = script
  }

  get callCount(): number {
    return this.calls.length
  }

  async query(query: PolicyQuery, opts?: PdpQueryOptions): Promise<PolicyDecision> {
    this.calls.push(query)
    this.optsLog.push({ timeoutMs: opts?.timeoutMs })
    if (this.script.delayMs !== undefined && this.script.delayMs > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, this.script.delayMs))
    }
    if (this.script.failWith !== undefined) throw this.script.failWith
    if (this.script.malformed !== undefined) return this.script.malformed as PolicyDecision
    const decisions = this.script.decisions ?? []
    if (decisions.length === 0) throw new Error('MockPdp: no decisions scripted')
    const decision = decisions[Math.min(this.calls.length - 1, decisions.length - 1)]
    if (decision === undefined) throw new Error('MockPdp: no decisions scripted')
    return decision
  }
}
