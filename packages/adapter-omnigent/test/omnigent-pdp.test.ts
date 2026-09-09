import { describe, it, expect, vi } from 'vitest'
import { parsePolicyQuery } from '@nexus/core'
import { OmnigentPdpClient } from '../src/index.js'

const baseQuery = parsePolicyQuery({
  request_id: 'req-test-1',
  policy_version: 'v1',
  subject: { kind: 'agent', name: 'test-agent', session_id: 'sess-1' },
  action: { type: 'tool_call', tool: 'memory.recall', args_meta: {} },
  resource: { type: 'memory' }
})

function mockFetch(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response)
  })
}

function mockFetchError(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body ?? { error: 'error' })
  })
}

describe('OmnigentPdpClient', () => {
  it('allow 决策 → 解析为 PolicyDecision', async () => {
    const fetchFn = mockFetch({ result: 'ALLOW', reason: 'static read allowed' })
    const client = new OmnigentPdpClient({ baseUrl: 'http://localhost:6767', fetch: fetchFn })
    const decision = await client.query(baseQuery)
    expect(decision.decision).toBe('allow')
    expect(decision.reason_code).toContain('OMNIGENT')
    expect(decision.audit_token).toMatch(/^aud-/)
  })

  it('deny 决策 → 解析为 PolicyDecision', async () => {
    const fetchFn = mockFetch({ result: 'DENY', reason: 'credential blocked' })
    const client = new OmnigentPdpClient({ baseUrl: 'http://localhost:6767', fetch: fetchFn })
    const decision = await client.query(baseQuery)
    expect(decision.decision).toBe('deny')
  })

  it('ask 决策 → 映射为 pause', async () => {
    const fetchFn = mockFetch({ result: 'ASK', reason: 'requires approval' })
    const client = new OmnigentPdpClient({ baseUrl: 'http://localhost:6767', fetch: fetchFn })
    const decision = await client.query(baseQuery)
    expect(decision.decision).toBe('pause')
  })

  it('请求体包含正确的 endpoint 和 session_id', async () => {
    const fetchFn = mockFetch({ result: 'ALLOW' })
    const client = new OmnigentPdpClient({ baseUrl: 'http://omni:6767', fetch: fetchFn })
    await client.query(baseQuery)
    expect(fetchFn).toHaveBeenCalledWith(
      'http://omni:6767/sessions/sess-1/policies/evaluate',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('请求体包含 Omnigent event 形状', async () => {
    const fetchFn = mockFetch({ result: 'ALLOW' })
    const client = new OmnigentPdpClient({ baseUrl: 'http://localhost:6767', fetch: fetchFn })
    await client.query(baseQuery)
    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)
    expect(body.type).toBe('tool_call')
    expect(body.target).toBe('memory.recall')
    expect(body.context.actor).toBe('test-agent')
  })

  it('网络错误 → fail-closed deny', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const client = new OmnigentPdpClient({ baseUrl: 'http://localhost:6767', fetch: fetchFn })
    const decision = await client.query(baseQuery)
    expect(decision.decision).toBe('deny')
    expect(decision.reason_code).toBe('OMNIGENT_UNREACHABLE')
  })

  it('HTTP 500 → fail-closed deny', async () => {
    const fetchFn = mockFetchError(500)
    const client = new OmnigentPdpClient({ baseUrl: 'http://localhost:6767', fetch: fetchFn })
    const decision = await client.query(baseQuery)
    expect(decision.decision).toBe('deny')
    expect(decision.reason_code).toBe('OMNIGENT_ERROR')
  })

  it('畸形响应 → fail-closed deny', async () => {
    const fetchFn = mockFetch({ result: 'INVALID' })
    const client = new OmnigentPdpClient({ baseUrl: 'http://localhost:6767', fetch: fetchFn })
    const decision = await client.query(baseQuery)
    expect(decision.decision).toBe('deny')
    expect(decision.reason_code).toBe('OMNIGENT_MALFORMED')
  })

  it('超时 → fail-closed deny', async () => {
    const fetchFn = vi.fn().mockImplementation(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('abort')), 50))
    )
    const client = new OmnigentPdpClient({
      baseUrl: 'http://localhost:6767',
      fetch: fetchFn,
      timeoutMs: 10
    })
    const decision = await client.query(baseQuery)
    expect(decision.decision).toBe('deny')
    expect(decision.reason_code).toBe('OMNIGENT_TIMEOUT')
  })

  it('自定义 timeoutMs 透传', async () => {
    const fetchFn = mockFetch({ result: 'ALLOW' })
    const client = new OmnigentPdpClient({
      baseUrl: 'http://localhost:6767',
      fetch: fetchFn,
      timeoutMs: 5000
    })
    await client.query(baseQuery)
    const init = fetchFn.mock.calls[0]![1]!
    expect(init.signal).toBeDefined()
  })

  it('headers 包含 Authorization', async () => {
    const fetchFn = mockFetch({ result: 'ALLOW' })
    const client = new OmnigentPdpClient({
      baseUrl: 'http://localhost:6767',
      fetch: fetchFn,
      apiKey: 'test-api-key'
    })
    await client.query(baseQuery)
    const init = fetchFn.mock.calls[0]![1]!
    expect(init.headers['Authorization']).toBe('Bearer test-api-key')
  })
})
