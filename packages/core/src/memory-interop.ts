import { z } from 'zod'

export const MemoryRecordV2Schema = z.object({
  schema_version: z.literal('nexus/memory/1'),
  agent: z.string().min(1),
  session_id: z.string().min(1),
  turn_id: z.string().min(1),
  ts: z.number().int().positive(),
  content: z.string().min(1),
  file: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  tags: z.array(z.string().min(1)),
  project: z.string().min(1),
  redacted: z.boolean(),
  redaction_applied: z.array(z.string().min(1)).optional(),
})

export type MemoryRecordV2 = z.infer<typeof MemoryRecordV2Schema>

export const MemoryRecordV2JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Nexus MemoryRecord v1',
  type: 'object',
  required: ['schema_version', 'agent', 'session_id', 'turn_id', 'ts', 'content', 'hash', 'tags', 'project', 'redacted'],
  properties: {
    schema_version: { type: 'string', const: 'nexus/memory/1' },
    agent: { type: 'string', minLength: 1 },
    session_id: { type: 'string', minLength: 1 },
    turn_id: { type: 'string', minLength: 1 },
    ts: { type: 'integer', minimum: 1 },
    content: { type: 'string', minLength: 1 },
    file: { type: 'string', minLength: 1 },
    line: { type: 'integer', minimum: 1 },
    hash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
    tags: { type: 'array', items: { type: 'string', minLength: 1 } },
    project: { type: 'string', minLength: 1 },
    redacted: { type: 'boolean' },
    redaction_applied: { type: 'array', items: { type: 'string', minLength: 1 } },
  },
  additionalProperties: false,
}

export type ValidateResult =
  | { ok: true; data: MemoryRecordV2 }
  | { ok: false; errors: string[] }

export function validateMemoryRecordV2(input: unknown): ValidateResult {
  const result = MemoryRecordV2Schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }
}

export function toMemoryRecordV2(input: Record<string, unknown>): MemoryRecordV2 {
  if ((input as Record<string, unknown>).schema_version === 'nexus/memory/1') {
    return MemoryRecordV2Schema.parse(input)
  }
  return MemoryRecordV2Schema.parse({ ...input, schema_version: 'nexus/memory/1' })
}
