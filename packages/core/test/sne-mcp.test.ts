import { describe, it, expect } from 'vitest'
import { sneToMcpNotification, mcpNotificationToSne } from '../src/sne-mcp.js'
import { makeEnvelope, type SnePayload } from '../src/sne.js'

function toolCallEnv() {
  return makeEnvelope({ name: 'agent-x', session_id: 'sess-42' }, {
    kind: 'tool_call',
    query: {
      request_id: 'req-1', policy_version: 'v1',
      subject: { kind: 'agent', name: 'agent-x', session_id: 'sess-42' },
      action: { type: 'tool_call', tool: 'memory.recall', args_meta: {} },
      resource: { type: 'memory' }
    }
  })
}

describe('SNE ↔ MCP 适配', () => {
  it('sneToMcpNotification 将 SNE envelope 转为 MCP notification 格式', () => {
    const env = toolCallEnv()
    const notif = sneToMcpNotification(env)
    expect(notif.jsonrpc).toBe('2.0')
    expect(notif.method).toBe('notifications/sne/event')
    expect(notif.params.kind).toBe('tool_call')
    expect(notif.params.sne_id).toBe(env.id)
    expect(notif.params.ts).toBe(env.ts)
    expect(notif.params.agent).toEqual({ name: 'agent-x', session_id: 'sess-42' })
  })

  it('mcpNotificationToSne 将 MCP notification 转回 SNE envelope（roundtrip）', () => {
    const env = toolCallEnv()
    const notif = sneToMcpNotification(env)
    const roundtrip = mcpNotificationToSne(notif)
    expect(roundtrip.id).toBe(env.id)
    expect(roundtrip.ts).toBe(env.ts)
    expect(roundtrip.schema).toBe('sne/1')
    expect(roundtrip.agent).toEqual(env.agent)
    expect(roundtrip.payload.kind).toBe('tool_call')
  })

  it('所有 5 种事件 kind 都可以 roundtrip', () => {
    const payloads = [
      { kind: 'tool_call' as const, query: {
        request_id: 'req-1', policy_version: 'v1',
        subject: { kind: 'agent' as const, name: 'a', session_id: 's' },
        action: { type: 'tool_call' as const, tool: 't', args_meta: {} },
        resource: { type: 'memory' as const }
      }},
      { kind: 'policy_decision' as const, decision: {
        decision: 'allow' as const, reason_code: 'r', ttl_seconds: 1, audit_token: 'aud-1'
      }, request_id: 'req-1' },
      { kind: 'memory.sync' as const, turn_id: 't1', records: 1, deduped: 0 },
      { kind: 'memory.recall' as const, query_text_hash: 'a'.repeat(64), hits: 1, injected_tokens: 100 },
      { kind: 'audit.beat' as const, event: {
        agent: 'a', session_id: 's', tool_call: 'tc', decision: 'allow' as const, token: 'aud-1'
      }}
    ]
    for (const payload of payloads) {
      const env = makeEnvelope({ name: 'a', session_id: 's' }, payload as SnePayload)
      const notif = sneToMcpNotification(env)
      const roundtrip = mcpNotificationToSne(notif)
      expect(roundtrip.payload.kind).toBe(payload.kind)
    }
  })
})
