import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { SchemaError } from './errors.js'

export const PolicyQuerySchema = z.object({
  request_id: z.string().regex(/^req-/),
  policy_version: z.string().min(1),
  subject: z.object({
    kind: z.literal('agent'),
    name: z.string().min(1),
    session_id: z.string().min(1)
  }),
  action: z.object({
    type: z.literal('tool_call'),
    tool: z.string().min(1),
    args_meta: z.object({
      cmd_hash: z.string().min(1).optional(),
      cmd_class: z.string().min(1).optional()
    })
  }),
  resource: z.object({
    type: z.enum(['file', 'process', 'network', 'memory', 'credential']),
    path: z.string().min(1).optional(),
    origin: z.string().min(1).optional()
  })
})

export type PolicyQuery = z.infer<typeof PolicyQuerySchema>

export const PolicyDecisionSchema = z.object({
  decision: z.enum(['allow', 'deny', 'pause']),
  reason_code: z.string().min(1),
  ttl_seconds: z.number().int().positive(),
  audit_token: z.string().regex(/^aud-/)
})

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>

export function parsePolicyQuery(input: unknown): PolicyQuery {
  try {
    return PolicyQuerySchema.parse(input)
  } catch (cause) {
    throw new SchemaError('invalid PolicyQuery', { cause })
  }
}

export function parsePolicyDecision(input: unknown): PolicyDecision {
  try {
    return PolicyDecisionSchema.parse(input)
  } catch (cause) {
    throw new SchemaError('invalid PolicyDecision', { cause })
  }
}

export function makeRequestId(): string {
  return `req-${randomUUID()}`
}

export function makeAuditToken(): string {
  return `aud-${randomUUID()}`
}

export interface PolicyQueryInput {
  agent: string
  sessionId: string
  tool: string
  resourceType?: PolicyQuery['resource']['type']
}

export function makePolicyQuery(input: PolicyQueryInput): PolicyQuery {
  return parsePolicyQuery({
    request_id: makeRequestId(),
    policy_version: 'v1',
    subject: { kind: 'agent', name: input.agent, session_id: input.sessionId },
    action: { type: 'tool_call', tool: input.tool, args_meta: {} },
    resource: { type: input.resourceType ?? 'memory' }
  })
}
