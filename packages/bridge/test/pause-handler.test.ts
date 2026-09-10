import { describe, it, expect } from 'vitest'
import { PauseHandler } from '../src/pause-handler.js'
import { makePolicyQuery } from '@nexus/core'

function makePepOutcome(decision: 'pause' | 'deny') {
  return {
    outcome: decision,
    decision: {
      decision,
      reason_code: decision === 'pause' ? 'ASK_REQUIRES_APPROVAL' : 'DENIED',
      ttl_seconds: 300,
      audit_token: 'aud-test-1'
    }
  }
}

describe('PauseHandler', () => {
  it('handle 写入 pending 文件并返回 pendingId', async () => {
    const writes: { path: string; data: string }[] = []
    const handler = new PauseHandler({
      dir: '/tmp/nexus-pause',
      writeFile: async (p, d) => { writes.push({ path: p, data: d }) },
      readFile: async () => '{"status":"pending"}'
    })
    const query = makePolicyQuery({ agent: 'a', sessionId: 's', tool: 't' })
    const result = await handler.handle(makePepOutcome('pause') as never, query)
    expect(result.status).toBe('pending')
    expect(result.pendingId).toBeDefined()
    expect(writes).toHaveLength(1)
    expect(writes[0]!.path).toContain('pending-')
  })

  it('respond 更新 pending 状态为 approved', async () => {
    const store = new Map<string, string>()
    const handler = new PauseHandler({
      dir: '/tmp/nexus-pause',
      writeFile: async (p, d) => { store.set(p, d) },
      readFile: async (p) => store.get(p) ?? '{}'
    })
    const query = makePolicyQuery({ agent: 'a', sessionId: 's', tool: 't' })
    const result = await handler.handle(makePepOutcome('pause') as never, query)
    await handler.respond(result.pendingId, 'approved')
    const status = await handler.getStatus(result.pendingId)
    expect(status).toBe('approved')
  })

  it('respond denied → 状态为 denied', async () => {
    const store = new Map<string, string>()
    const handler = new PauseHandler({
      dir: '/tmp/nexus-pause',
      writeFile: async (p, d) => { store.set(p, d) },
      readFile: async (p) => store.get(p) ?? '{}'
    })
    const query = makePolicyQuery({ agent: 'a', sessionId: 's', tool: 't' })
    const result = await handler.handle(makePepOutcome('pause') as never, query)
    await handler.respond(result.pendingId, 'denied')
    expect(await handler.getStatus(result.pendingId)).toBe('denied')
  })

  it('pending 文件包含 query 和 decision 元数据', async () => {
    let captured = ''
    const handler = new PauseHandler({
      dir: '/tmp/nexus-pause',
      writeFile: async (_p, d) => { captured = d },
      readFile: async () => '{}'
    })
    const query = makePolicyQuery({ agent: 'alice', sessionId: 's42', tool: 'memory.save' })
    await handler.handle(makePepOutcome('pause') as never, query)
    const data = JSON.parse(captured)
    expect(data.query.subject.name).toBe('alice')
    expect(data.query.subject.session_id).toBe('s42')
    expect(data.decision.decision).toBe('pause')
  })

  it('getStatus 返回 unknown 对不存在的 pendingId', async () => {
    const handler = new PauseHandler({
      dir: '/tmp',
      writeFile: async () => {},
      readFile: async () => '{}'
    })
    expect(await handler.getStatus('nonexistent')).toBe('unknown')
  })
})
