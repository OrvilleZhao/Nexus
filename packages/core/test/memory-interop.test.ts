import { describe, it, expect } from 'vitest'
import {
  MemoryRecordV2Schema,
  MemoryRecordV2JsonSchema,
  validateMemoryRecordV2,
  toMemoryRecordV2,
} from '../src/memory-interop.js'

describe('MemoryRecordV2 (interop schema)', () => {
  const validRecord = {
    schema_version: 'nexus/memory/1',
    agent: 'test-agent',
    session_id: 's1',
    turn_id: 't1',
    ts: 1700000000000,
    content: 'user asked about deployment',
    hash: 'a'.repeat(64),
    tags: ['deployment', 'k8s'],
    project: 'my-app',
    redacted: true,
  }

  it('validates a correct record', () => {
    const result = MemoryRecordV2Schema.safeParse(validRecord)
    expect(result.success).toBe(true)
  })

  it('rejects missing schema_version', () => {
    const { schema_version: _, ...noVersion } = validRecord
    const result = MemoryRecordV2Schema.safeParse(noVersion)
    expect(result.success).toBe(false)
  })

  it('rejects wrong schema_version', () => {
    const result = MemoryRecordV2Schema.safeParse({ ...validRecord, schema_version: 'wrong' })
    expect(result.success).toBe(false)
  })

  it('rejects empty agent', () => {
    const result = MemoryRecordV2Schema.safeParse({ ...validRecord, agent: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid hash length', () => {
    const result = MemoryRecordV2Schema.safeParse({ ...validRecord, hash: 'short' })
    expect(result.success).toBe(false)
  })

  it('export produces valid JSON Schema', () => {
    expect(MemoryRecordV2JsonSchema).toHaveProperty('$schema', 'http://json-schema.org/draft-07/schema#')
    expect(MemoryRecordV2JsonSchema).toHaveProperty('properties.schema_version')
    expect(MemoryRecordV2JsonSchema.properties!.schema_version).toEqual({ type: 'string', const: 'nexus/memory/1' })
  })

  it('validateMemoryRecordV2 returns ok for valid input', () => {
    const result = validateMemoryRecordV2(validRecord)
    expect(result.ok).toBe(true)
  })

  it('validateMemoryRecordV2 returns error for invalid input', () => {
    const result = validateMemoryRecordV2({ not: 'a record' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('toMemoryRecordV2 upgrades v1 record', () => {
    const v1 = {
      agent: 'agent-1',
      session_id: 's1',
      turn_id: 't1',
      ts: 1700000000000,
      content: 'hello',
      hash: 'b'.repeat(64),
      tags: ['greeting'],
      project: 'proj',
      redacted: false,
    }
    const v2 = toMemoryRecordV2(v1)
    expect(v2.schema_version).toBe('nexus/memory/1')
    expect(v2.agent).toBe('agent-1')
    expect(v2.content).toBe('hello')
  })

  it('toMemoryRecordV2 preserves v2 record', () => {
    const v2 = toMemoryRecordV2(validRecord)
    expect(v2.schema_version).toBe('nexus/memory/1')
    expect(v2).toEqual(validRecord)
  })

  it('schema includes optional file and line fields', () => {
    const withFile = { ...validRecord, file: 'src/main.ts', line: 42 }
    const result = MemoryRecordV2Schema.safeParse(withFile)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.file).toBe('src/main.ts')
      expect(result.data.line).toBe(42)
    }
  })

  it('schema includes optional redaction_applied field', () => {
    const withRedaction = { ...validRecord, redaction_applied: ['EMAIL', 'IP'] }
    const result = MemoryRecordV2Schema.safeParse(withRedaction)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.redaction_applied).toEqual(['EMAIL', 'IP'])
    }
  })
})
