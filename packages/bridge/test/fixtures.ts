import { parsePolicyQuery } from '@nexus/core'
import type { AuditEvent, PolicyDecision, PolicyQuery } from '@nexus/core'

export const baseQuery = {
  request_id: 'req-1',
  policy_version: 'omnigent-policy-v1',
  subject: { kind: 'agent', name: 'nexus-dev-01', session_id: 'sess-1' },
  action: { type: 'tool_call', tool: 'shell', args_meta: { cmd_class: 'file_write', cmd_hash: 'h1' } },
  resource: { type: 'file', path: '/repo/src/main.go' }
}

export function q(patch: Record<string, unknown> = {}): PolicyQuery {
  return parsePolicyQuery({ ...baseQuery, ...patch })
}

export const allowDecision: PolicyDecision = {
  decision: 'allow',
  reason_code: 'R1',
  ttl_seconds: 300,
  audit_token: 'aud-allow-1'
}

export const denyDecision: PolicyDecision = {
  decision: 'deny',
  reason_code: 'R2',
  ttl_seconds: 300,
  audit_token: 'aud-deny-1'
}

export const pauseDecision: PolicyDecision = {
  decision: 'pause',
  reason_code: 'HUMAN_REVIEW',
  ttl_seconds: 300,
  audit_token: 'aud-pause-1'
}

export function auditCollector(): { audits: AuditEvent[]; sink: (event: AuditEvent) => void } {
  const audits: AuditEvent[] = []
  return { audits, sink: event => audits.push(event) }
}
