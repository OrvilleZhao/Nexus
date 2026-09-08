import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AuditEventSchema } from './audit.js'
import { SchemaError } from './errors.js'
import { PolicyDecisionSchema, PolicyQuerySchema } from './policy.js'

export const SNE_SCHEMA_VERSION = 'sne/1'

export const SnePayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tool_call'),
    query: PolicyQuerySchema
  }),
  z.object({
    kind: z.literal('policy_decision'),
    decision: PolicyDecisionSchema,
    request_id: z.string().regex(/^req-/)
  }),
  z.object({
    kind: z.literal('memory.sync'),
    turn_id: z.string().min(1),
    records: z.number().int().nonnegative(),
    deduped: z.number().int().nonnegative()
  }),
  z.object({
    kind: z.literal('memory.recall'),
    query_text_hash: z.string().regex(/^[0-9a-f]{64}$/),
    hits: z.number().int().nonnegative(),
    injected_tokens: z.number().int().nonnegative()
  }),
  z.object({
    kind: z.literal('audit.beat'),
    event: AuditEventSchema
  })
])

export type SnePayload = z.infer<typeof SnePayloadSchema>

export interface SneAgentRef {
  name: string
  session_id: string
}

export interface SneEnvelope<P extends SnePayload = SnePayload> {
  id: string
  ts: number
  schema: 'sne/1'
  agent: SneAgentRef
  payload: P
}

export function parseSnePayload(input: unknown): SnePayload {
  try {
    return SnePayloadSchema.parse(input)
  } catch (cause) {
    throw new SchemaError('invalid SnePayload', { cause })
  }
}

export function makeEnvelope(agent: SneAgentRef, payload: SnePayload): SneEnvelope {
  return {
    id: randomUUID(),
    ts: Date.now(),
    schema: SNE_SCHEMA_VERSION,
    agent,
    payload: parseSnePayload(payload)
  }
}
