import { makeAuditToken, type PolicyDecision, type PolicyQuery, type PdpClient } from '@nexus/core'

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>

export interface OmnigentPdpClientOptions {
  baseUrl: string
  fetch?: FetchFn
  timeoutMs?: number
  apiKey?: string | undefined
}

interface OmnigentEvent {
  type: string
  target: string
  data: Record<string, unknown>
  context: { actor: string; session_id: string }
}

const OMNIGENT_RESULT_MAP: Record<string, PolicyDecision['decision']> = {
  ALLOW: 'allow',
  DENY: 'deny',
  ASK: 'pause'
}

export class OmnigentPdpClient implements PdpClient {
  private readonly baseUrl: string
  private readonly fetchFn: FetchFn
  private readonly timeoutMs: number
  private readonly apiKey: string | undefined

  constructor(opts: OmnigentPdpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = opts.timeoutMs ?? 2000
    this.apiKey = opts.apiKey
  }

  async query(query: PolicyQuery): Promise<PolicyDecision> {
    try {
      return await this.queryWithTimeout(query)
    } catch (cause) {
      return this.failClosed(cause)
    }
  }

  private async queryWithTimeout(query: PolicyQuery): Promise<PolicyDecision> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const url = `${this.baseUrl}/sessions/${query.subject.session_id}/policies/evaluate`
      const event = this.toEvent(query)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.apiKey !== undefined) headers['Authorization'] = `Bearer ${this.apiKey}`

      const res = await this.fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        signal: controller.signal
      })

      if (!res.ok) {
        return this.failClosed(new Error(`HTTP ${res.status}`))
      }

      const body: unknown = await res.json()
      return this.parseResponse(body)
    } finally {
      clearTimeout(timer)
    }
  }

  private toEvent(query: PolicyQuery): OmnigentEvent {
    return {
      type: query.action.type,
      target: query.action.tool,
      data: { args_meta: query.action.args_meta, resource: query.resource },
      context: { actor: query.subject.name, session_id: query.subject.session_id }
    }
  }

  private parseResponse(body: unknown): PolicyDecision {
    if (typeof body !== 'object' || body === null) {
      return this.failClosed(new Error('non-object response'))
    }
    const { result, reason } = body as Record<string, unknown>
    if (typeof result !== 'string' || !(result in OMNIGENT_RESULT_MAP)) {
      return this.failClosed(new Error(`invalid result: ${String(result)}`))
    }
    return {
      decision: OMNIGENT_RESULT_MAP[result]!,
      reason_code: `OMNIGENT_${result}${reason !== undefined ? ':' + String(reason) : ''}`,
      ttl_seconds: 300,
      audit_token: makeAuditToken()
    }
  }

  private failClosed(cause: unknown): PolicyDecision {
    const reason = cause instanceof Error ? cause.message : String(cause)
    const code = reason.includes('abort') ? 'OMNIGENT_TIMEOUT'
      : reason.includes('ECONNREFUSED') || reason.includes('fetch failed') ? 'OMNIGENT_UNREACHABLE'
      : reason.startsWith('HTTP') ? 'OMNIGENT_ERROR'
      : 'OMNIGENT_MALFORMED'
    return {
      decision: 'deny',
      reason_code: code,
      ttl_seconds: 1,
      audit_token: makeAuditToken()
    }
  }
}
