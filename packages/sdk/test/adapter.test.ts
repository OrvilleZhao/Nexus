import { describe, it, expect, vi } from 'vitest'
import { createNexusAdapter } from '../src/index.js'

describe('createNexusAdapter', () => {
  it('返回 adapter 对象（含 intercept/saveTurn/recall/getAuditSummary）', () => {
    const pdp = { query: vi.fn().mockResolvedValue({ decision: 'allow', reason_code: 'test', ttl_seconds: 300, audit_token: 'aud-1' }) }
    const adapter = createNexusAdapter({ pdp })
    expect(typeof adapter.intercept).toBe('function')
    expect(typeof adapter.saveTurn).toBe('function')
    expect(typeof adapter.recall).toBe('function')
    expect(typeof adapter.getAuditSummary).toBe('function')
  })

  it('intercept 调用 PEP 并返回 outcome', async () => {
    const pdp = { query: vi.fn().mockResolvedValue({ decision: 'allow', reason_code: 'ok', ttl_seconds: 300, audit_token: 'aud-1' }) }
    const adapter = createNexusAdapter({ pdp })
    const outcome = await adapter.intercept({
      request_id: 'req-1', policy_version: 'v1',
      subject: { kind: 'agent', name: 'a', session_id: 's' },
      action: { type: 'tool_call', tool: 't', args_meta: {} },
      resource: { type: 'memory' }
    })
    expect(outcome.outcome).toBe('execute')
  })

  it('saveTurn 保存 turn 到 TrajectorySync', () => {
    const pdp = { query: vi.fn() }
    const adapter = createNexusAdapter({ pdp })
    const record = adapter.saveTurn({ agent: 'a', session_id: 's', content: 'test', tool_call_id: 't1' })
    expect(record).not.toBeNull()
    expect(record!.agent).toBe('a')
  })

  it('recall 调用 FunesClient（mock exec）', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'no results\n' })
    const pdp = { query: vi.fn() }
    const adapter = createNexusAdapter({ pdp, funesExec: exec })
    const result = await adapter.recall('test query')
    expect(result.hits).toHaveLength(0)
    expect(exec).toHaveBeenCalled()
  })

  it('getAuditSummary 返回 session 统计', () => {
    const pdp = { query: vi.fn().mockResolvedValue({ decision: 'allow', reason_code: 'ok', ttl_seconds: 300, audit_token: 'aud-1' }) }
    const adapter = createNexusAdapter({ pdp })
    adapter.auditEngine.record({
      agent: 'a', session_id: 's1', tool_call: 'tc', decision: 'allow', token: 'aud-1'
    })
    adapter.auditEngine.record({
      agent: 'a', session_id: 's1', tool_call: 'tc', decision: 'deny', token: 'aud-2'
    })
    const summary = adapter.getAuditSummary('s1')
    expect(summary.total).toBe(2)
    expect(summary.allow).toBe(1)
    expect(summary.deny).toBe(1)
  })

  it('denied outcome 不执行回调', async () => {
    const pdp = { query: vi.fn().mockResolvedValue({ decision: 'deny', reason_code: 'BLOCKED', ttl_seconds: 1, audit_token: 'aud-1' }) }
    const adapter = createNexusAdapter({ pdp })
    const cb = vi.fn()
    const result = await adapter.intercept(
      { request_id: 'req-1', policy_version: 'v1',
        subject: { kind: 'agent', name: 'a', session_id: 's' },
        action: { type: 'tool_call', tool: 't', args_meta: {} },
        resource: { type: 'memory' }
      },
      cb
    )
    expect(result.outcome).toBe('reject')
    expect(cb).not.toHaveBeenCalled()
  })

  it('allow + callback → 执行回调', async () => {
    const pdp = { query: vi.fn().mockResolvedValue({ decision: 'allow', reason_code: 'ok', ttl_seconds: 300, audit_token: 'aud-1' }) }
    const adapter = createNexusAdapter({ pdp })
    const cb = vi.fn().mockResolvedValue(undefined)
    const result = await adapter.intercept(
      { request_id: 'req-1', policy_version: 'v1',
        subject: { kind: 'agent', name: 'a', session_id: 's' },
        action: { type: 'tool_call', tool: 't', args_meta: {} },
        resource: { type: 'memory' }
      },
      cb
    )
    expect(result.outcome).toBe('execute')
    expect(cb).toHaveBeenCalledOnce()
  })
})
