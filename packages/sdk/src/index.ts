import {
  AuditEngine,
  SneeEmitter,
  type PdpClient,
  type PolicyQuery,
  type PepOutcome
} from '@nexus/core'
import { Pep } from '@nexus/bridge'
import { TrajectorySync, FunesClient, InjectionBudget, type ExecFn, type MemoryRecord, type RecallResult } from '@nexus/memory'

export interface NexusAdapterConfig {
  pdp: PdpClient
  funesExec?: ExecFn
  auditSink?: (event: unknown) => void
  injectionBudgetTokens?: number
}

export interface NexusAdapter {
  intercept(query: PolicyQuery, cb?: () => Promise<unknown>): Promise<PepOutcome>
  saveTurn(turn: { agent: string; session_id: string; content: string; tool_call_id: string }): MemoryRecord | null
  recall(query: string, opts?: { k?: number }): Promise<RecallResult>
  getAuditSummary(sessionId: string): ReturnType<AuditEngine['summaryBySession']>
  readonly auditEngine: AuditEngine
  readonly pep: Pep
  readonly sneEmitter: SneeEmitter
}

export function createNexusAdapter(config: NexusAdapterConfig): NexusAdapter {
  const auditEngine = new AuditEngine()
  const sneEmitter = new SneeEmitter()
  const _budget = new InjectionBudget({ maxTokens: config.injectionBudgetTokens ?? 2000 })

  const pep = new Pep({
    pdp: config.pdp,
    auditSink: (event) => {
      auditEngine.record(event as never)
      config.auditSink?.(event)
    }
  })

  const trajectorySync = new TrajectorySync({
    auditSink: (event) => {
      auditEngine.record(event as never)
      sneEmitter.emit({
        id: `sne-${Date.now()}`,
        ts: Date.now(),
        schema: 'sne/1',
        agent: { name: 'system', session_id: 'global' },
        payload: { kind: 'audit.beat', event: event as never }
      })
    }
  })

  const funesClient = config.funesExec !== undefined
    ? new FunesClient({ exec: config.funesExec })
    : undefined

  return {
    auditEngine,
    pep,
    sneEmitter,

    async intercept(query: PolicyQuery, cb?: () => Promise<unknown>): Promise<PepOutcome> {
      const outcome = await pep.intercept(query)
      if (outcome.outcome === 'execute' && cb !== undefined) {
        await cb()
      }
      return outcome
    },

    saveTurn(turn) {
      return trajectorySync.saveTurn(turn)
    },

    async recall(query: string, opts?: { k?: number }) {
      if (funesClient === undefined) return { hits: [] }
      return funesClient.recall(query, opts)
    },

    getAuditSummary(sessionId: string) {
      return auditEngine.summaryBySession(sessionId)
    }
  }
}
