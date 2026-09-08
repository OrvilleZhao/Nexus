import {
  makeAuditToken,
  makeCacheKey,
  parsePolicyDecision,
  SchemaError,
  type AuditEvent,
  type PolicyDecision,
  type PolicyQuery,
  type PdpClient,
  type PepOutcome
} from '@nexus/core'
import { DecisionCache } from './decision-cache.js'
import { DEFAULT_STATIC_RULES, StaticRuleSet, type StaticRule } from './static-rules.js'

const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_STATIC_TTL_SECONDS = 300

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`pdp query timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

export interface PepOptions {
  pdp: PdpClient
  staticRules?: StaticRule[]
  staticTtlSeconds?: number
  timeoutMs?: number
  clock?: () => number
  auditSink?: (event: AuditEvent) => void
}

interface PdpResult {
  decision: PolicyDecision
  failClosed: boolean
}

export class Pep {
  private readonly pdp: PdpClient
  private readonly cache: DecisionCache
  private readonly rules: StaticRuleSet
  private readonly timeoutMs: number
  private readonly staticTtlSeconds: number
  private readonly clock: () => number
  private readonly auditSink: (event: AuditEvent) => void

  constructor(opts: PepOptions) {
    this.pdp = opts.pdp
    this.clock = opts.clock ?? (() => Date.now())
    this.cache = new DecisionCache({ clock: this.clock })
    this.rules = new StaticRuleSet(opts.staticRules ?? DEFAULT_STATIC_RULES)
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.staticTtlSeconds = opts.staticTtlSeconds ?? DEFAULT_STATIC_TTL_SECONDS
    this.auditSink = opts.auditSink ?? (() => {})
  }

  async intercept(query: PolicyQuery): Promise<PepOutcome> {
    const cached = this.cache.get(makeCacheKey(query))
    if (cached !== undefined) return this.apply(query, cached)

    const rule = this.rules.firstMatch(query)
    if (rule !== undefined) {
      const decision: PolicyDecision =
        rule.effect === 'deny'
          ? { decision: 'deny', reason_code: `STATIC_${rule.id}`, ttl_seconds: 0, audit_token: makeAuditToken() }
          : {
              decision: 'allow',
              reason_code: `STATIC_${rule.id}`,
              ttl_seconds: this.staticTtlSeconds,
              audit_token: makeAuditToken()
            }
      if (rule.effect === 'allow') this.cache.set(makeCacheKey(query), decision)
      return this.apply(query, decision)
    }

    const result = await this.queryPdpFailClosed(query)
    if (result.failClosed) {
      this.emitAudit(query, 'fail_closed', result.decision.audit_token)
      return { outcome: 'reject', decision: result.decision }
    }
    if (result.decision.decision !== 'pause' && result.decision.ttl_seconds > 0) {
      this.cache.set(makeCacheKey(query), result.decision)
    }
    return this.apply(query, result.decision)
  }

  private apply(query: PolicyQuery, decision: PolicyDecision): PepOutcome {
    this.emitAudit(query, decision.decision, decision.audit_token)
    const outcome =
      decision.decision === 'allow' ? 'execute' : decision.decision === 'deny' ? 'reject' : 'pause'
    return { outcome, decision }
  }

  private async queryPdpFailClosed(query: PolicyQuery): Promise<PdpResult> {
    try {
      const raw = await this.withTimeout(this.pdp.query(query, { timeoutMs: this.timeoutMs }))
      return { decision: parsePolicyDecision(raw), failClosed: false }
    } catch (cause) {
      const decision: PolicyDecision = {
        decision: 'deny',
        reason_code: this.failReason(cause),
        ttl_seconds: 0,
        audit_token: makeAuditToken()
      }
      return { decision, failClosed: true }
    }
  }

  private failReason(cause: unknown): string {
    if (cause instanceof TimeoutError) return 'PDP_TIMEOUT'
    if (cause instanceof SchemaError) return 'PDP_MALFORMED'
    return 'PDP_UNREACHABLE'
  }

  private async withTimeout(promise: Promise<unknown>): Promise<unknown> {
    promise.catch(() => {})
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new TimeoutError(this.timeoutMs)), this.timeoutMs)
        })
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  private emitAudit(query: PolicyQuery, decision: AuditEvent['decision'], token: string): void {
    this.auditSink({
      agent: query.subject.name,
      session_id: query.subject.session_id,
      tool_call: query.request_id,
      decision,
      token
    })
  }
}
