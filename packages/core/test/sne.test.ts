import { describe, expect, it } from 'vitest'
import { makeEnvelope, SNE_SCHEMA_VERSION, SchemaError } from '../src/index.js'

const agent = { name: 'nexus-dev-01', session_id: 'sess-1' }

const toolCallPayload = {
  kind: 'tool_call',
  query: {
    request_id: 'req-1',
    policy_version: 'omnigent-policy-v1',
    subject: { kind: 'agent', name: 'nexus-dev-01', session_id: 'sess-1' },
    action: { type: 'tool_call', tool: 'shell', args_meta: { cmd_class: 'file_write' } },
    resource: { type: 'file', path: '/repo/src/main.go' }
  }
} as const

describe('makeEnvelope', () => {
  it('自动生成 uuid 与时间戳，schema 固定 sne/1', () => {
    const before = Date.now()
    const envelope = makeEnvelope(agent, toolCallPayload)
    const after = Date.now()
    expect(envelope.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(envelope.ts).toBeGreaterThanOrEqual(before)
    expect(envelope.ts).toBeLessThanOrEqual(after)
    expect(envelope.schema).toBe('sne/1')
    expect(envelope.schema).toBe(SNE_SCHEMA_VERSION)
    expect(envelope.agent).toEqual(agent)
  })

  it('两次调用生成不同 id', () => {
    const a = makeEnvelope(agent, toolCallPayload)
    const b = makeEnvelope(agent, toolCallPayload)
    expect(a.id).not.toBe(b.id)
  })

  it('未知 payload kind → SchemaError', () => {
    expect(() => makeEnvelope(agent, { kind: 'nonsense' } as never)).toThrowError(SchemaError)
  })

  it('memory.recall 的 query_text_hash 必须为 64 位十六进制', () => {
    expect(() =>
      makeEnvelope(agent, {
        kind: 'memory.recall',
        query_text_hash: 'short',
        hits: 0,
        injected_tokens: 0
      } as never)
    ).toThrowError(SchemaError)
  })

  it('policy_decision payload 校验内嵌 decision', () => {
    expect(() =>
      makeEnvelope(agent, {
        kind: 'policy_decision',
        decision: { decision: 'allow', reason_code: 'R1', ttl_seconds: 300, audit_token: 'bad' },
        request_id: 'req-1'
      } as never)
    ).toThrowError(SchemaError)
  })
})
