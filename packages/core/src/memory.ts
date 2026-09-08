import { createHash } from 'node:crypto'
import { z } from 'zod'
import { RedactionError, SchemaError } from './errors.js'
import { redactContent } from './redactor.js'

export const MemoryRecordSchema = z.object({
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
  redaction_applied: z.array(z.string().min(1)).optional()
})

export type MemoryRecord = z.infer<typeof MemoryRecordSchema>

export interface MemoryRecordInput {
  agent: string
  session_id: string
  turn_id: string
  content: string
  ts?: number
  file?: string
  line?: number
  tags?: string[]
  project: string
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

export function makeMemoryRecord(input: MemoryRecordInput): MemoryRecord {
  const { content, applied } = redactContent(input.content)
  const record: MemoryRecord = {
    agent: input.agent,
    session_id: input.session_id,
    turn_id: input.turn_id,
    ts: input.ts ?? Date.now(),
    content,
    hash: sha256Hex(content),
    tags: input.tags ?? [],
    project: input.project,
    redacted: true,
    redaction_applied: applied
  }
  if (input.file !== undefined) record.file = input.file
  if (input.line !== undefined) record.line = input.line
  try {
    return MemoryRecordSchema.parse(record)
  } catch (cause) {
    throw new SchemaError('invalid MemoryRecord', { cause })
  }
}

export function assertExportable(record: MemoryRecord): void {
  if (!record.redacted) {
    throw new RedactionError(
      `record ${record.session_id}/${record.turn_id} 未通过脱敏管线（redacted=false），拒绝导出`
    )
  }
}
