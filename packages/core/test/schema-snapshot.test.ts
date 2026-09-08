import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  AuditEventSchema,
  DecisionCacheKeySchema,
  MemoryRecordSchema,
  PolicyDecisionSchema,
  PolicyQuerySchema,
  SnePayloadSchema
} from '../src/index.js'

const schemasDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas')

const cases = [
  ['policy-query', PolicyQuerySchema],
  ['policy-decision', PolicyDecisionSchema],
  ['memory-record', MemoryRecordSchema],
  ['audit-event', AuditEventSchema],
  ['decision-cache-key', DecisionCacheKeySchema],
  ['sne-payload', SnePayloadSchema]
] as const

describe('schema 快照（跨语言契约：Omnigent Python 侧依赖同一份 JSON Schema）', () => {
  it.each(cases)('%s 与提交的快照一致（变更须显式重新生成并 commit）', (name, schema) => {
    const snapshot = JSON.parse(readFileSync(path.join(schemasDir, `${name}.json`), 'utf8'))
    expect(zodToJsonSchema(schema)).toEqual(snapshot)
  })
})
