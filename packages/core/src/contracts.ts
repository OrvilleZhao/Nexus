import { z } from 'zod'

// ── DSH Contract ──

export const DshToolCallSchema = z.object({
  tool: z.string().min(1),
  args: z.array(z.unknown()),
  session_id: z.string().min(1),
  agent: z.string().min(1),
  call_id: z.string().min(1),
})

export type DshToolCall = z.infer<typeof DshToolCallSchema>

export const DshContractSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Nexus DSH ToolCall Contract',
  type: 'object',
  required: ['tool', 'args', 'session_id', 'agent', 'call_id'],
  properties: {
    tool: { type: 'string', minLength: 1 },
    args: { type: 'array' },
    session_id: { type: 'string', minLength: 1 },
    agent: { type: 'string', minLength: 1 },
    call_id: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
}

// ── Funes Contract ──

export const FunesTurnSchema = z.object({
  turn_id: z.string().min(1),
  session_id: z.string().min(1),
  content: z.string(),
  score: z.number().min(0).max(1),
  ts: z.number().int().positive(),
})

export const FunesRecallResultSchema = z.object({
  turns: z.array(FunesTurnSchema),
  total: z.number().int().min(0),
})

export type FunesRecallResult = z.infer<typeof FunesRecallResultSchema>

export const FunesContractSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Nexus Funes RecallResult Contract',
  type: 'object',
  required: ['turns', 'total'],
  properties: {
    turns: {
      type: 'array',
      items: {
        type: 'object',
        required: ['turn_id', 'session_id', 'content', 'score', 'ts'],
        properties: {
          turn_id: { type: 'string', minLength: 1 },
          session_id: { type: 'string', minLength: 1 },
          content: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          ts: { type: 'integer', minimum: 1 },
        },
      },
    },
    total: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
}

// ── PDP Contract ──

export const PdpQueryResponseSchema = z.object({
  decision: z.enum(['allow', 'deny', 'pause']),
  policy_version: z.string().min(1),
  reason: z.string(),
  ttl: z.number().int().min(0),
})

export type PdpQueryResponse = z.infer<typeof PdpQueryResponseSchema>

export const PdpContractSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Nexus PDP QueryResponse Contract',
  type: 'object',
  required: ['decision', 'policy_version', 'reason', 'ttl'],
  properties: {
    decision: { type: 'string', enum: ['allow', 'deny', 'pause'] },
    policy_version: { type: 'string', minLength: 1 },
    reason: { type: 'string' },
    ttl: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
}

// ── Validators ──

export type ContractResult =
  | { ok: true }
  | { ok: false; errors: string[] }

export function validateDshPayload(input: unknown): ContractResult {
  const r = DshToolCallSchema.safeParse(input)
  if (r.success) return { ok: true }
  return { ok: false, errors: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }
}

export function validateFunesPayload(input: unknown): ContractResult {
  const r = FunesRecallResultSchema.safeParse(input)
  if (r.success) return { ok: true }
  return { ok: false, errors: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }
}

export function validatePdpPayload(input: unknown): ContractResult {
  const r = PdpQueryResponseSchema.safeParse(input)
  if (r.success) return { ok: true }
  return { ok: false, errors: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }
}
