import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  AuditEventSchema,
  DecisionCacheKeySchema,
  MemoryRecordSchema,
  PolicyDecisionSchema,
  PolicyQuerySchema,
  SnePayloadSchema
} from '../src/index.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas')

const schemas = {
  'policy-query': PolicyQuerySchema,
  'policy-decision': PolicyDecisionSchema,
  'memory-record': MemoryRecordSchema,
  'audit-event': AuditEventSchema,
  'decision-cache-key': DecisionCacheKeySchema,
  'sne-payload': SnePayloadSchema
}

mkdirSync(dir, { recursive: true })
for (const [name, schema] of Object.entries(schemas)) {
  const out = path.join(dir, `${name}.json`)
  writeFileSync(out, `${JSON.stringify(zodToJsonSchema(schema), null, 2)}\n`)
  console.log(`wrote ${out}`)
}
