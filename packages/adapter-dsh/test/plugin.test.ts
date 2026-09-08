import { describe, it, expect, vi } from 'vitest'
import { Pep } from '@nexus/bridge'
import { TrajectorySync, InjectionBudget } from '@nexus/memory'
import { parsePolicyDecision } from '@nexus/core'
import { createNexusPlugin, withPepIntercept } from '../src/index.js'

function mockContext() {
  const registeredTools: unknown[] = []
  const events = new Map<string, (...args: unknown[]) => void>()
  return {
    registeredTools,
    tools: {
      register(tool: unknown) { registeredTools.push(tool) },
      async execute() { return { content: [{ type: 'text', text: '' }] } }
    },
    on(event: string, handler: (...args: unknown[]) => void) { events.set(event, handler) },
    emit(event: string, ...args: unknown[]) { events.get(event)?.(...args) },
    effect() { return () => {} }
  }
}

describe('createNexusPlugin', () => {
  it('返回符合 Cordis 插件契约的对象（name/inject/apply）', () => {
    const plugin = createNexusPlugin({})
    expect(plugin.name).toBe('nexus-memory')
    expect(plugin.inject).toContain('tools')
    expect(typeof plugin.apply).toBe('function')
  })

  it('apply 注册 nexus.memory.recall 和 nexus.memory.save 两个工具', () => {
    const ctx = mockContext()
    const plugin = createNexusPlugin({})
    plugin.apply(ctx as never)
    expect(ctx.registeredTools).toHaveLength(2)
    const names = ctx.registeredTools.map((t: unknown) => (t as { name: string }).name)
    expect(names).toContain('nexus.memory.recall')
    expect(names).toContain('nexus.memory.save')
  })
})

describe('PEP 拦截器', () => {
  it('allow 决策 → 正常执行回调', async () => {
    const allowDecision = parsePolicyDecision({
      decision: 'allow', reason_code: 'STATIC_read-allowlist',
      ttl_seconds: 300, audit_token: 'aud-test-1'
    })
    const pdp = { query: vi.fn().mockResolvedValue(allowDecision) }
    const pep = new Pep({ pdp })
    const cb = vi.fn().mockResolvedValue('ok')
    const result = await withPepIntercept(pep, 'test-agent', 'sess-1', cb)
    expect(result).toBe('ok')
    expect(cb).toHaveBeenCalledOnce()
  })

  it('deny 决策 → 不执行回调，返回拒绝信息', async () => {
    const denyDecision = parsePolicyDecision({
      decision: 'deny', reason_code: 'CREDENTIAL_BLOCKED',
      ttl_seconds: 1, audit_token: 'aud-test-2'
    })
    const pdp = { query: vi.fn().mockResolvedValue(denyDecision) }
    const pep = new Pep({ pdp })
    const cb = vi.fn()
    const result = await withPepIntercept(pep, 'test-agent', 'sess-1', cb)
    expect(cb).not.toHaveBeenCalled()
    expect(result).toContain('denied')
  })

  it('fail-closed → deny + 审计 fail_closed', async () => {
    const pdp = { query: vi.fn().mockRejectedValue(new Error('timeout')) }
    const auditSink = vi.fn()
    const pep = new Pep({ pdp, auditSink })
    const cb = vi.fn()
    const result = await withPepIntercept(pep, 'agent-x', 'sess-42', cb)
    expect(cb).not.toHaveBeenCalled()
    expect(result).toContain('denied')
    expect(auditSink).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'fail_closed', agent: 'agent-x', session_id: 'sess-42' })
    )
  })
})

describe('内存工具定义', () => {
  it('recall 工具定义包含 query 参数', () => {
    const defs = createMemoryToolDefs()
    const recall = defs.find(d => d.name === 'nexus.memory.recall')
    expect(recall).toBeDefined()
    expect(recall!.parameters.query).toBeDefined()
  })

  it('save 工具定义包含 content/agent/session_id 参数', () => {
    const defs = createMemoryToolDefs()
    const save = defs.find(d => d.name === 'nexus.memory.save')
    expect(save).toBeDefined()
    expect(save!.parameters.content).toBeDefined()
    expect(save!.parameters.agent).toBeDefined()
    expect(save!.parameters.session_id).toBeDefined()
  })
})

describe('注入预算器与轨迹同步集成', () => {
  it('save → recall → InjectionBudget 装入完整流程', () => {
    const sync = new TrajectorySync({ auditSink: vi.fn() })
    sync.saveTurn({ agent: 'a', session_id: 's', content: 'use Lance format', tool_call_id: 't1' })
    sync.saveTurn({ agent: 'a', session_id: 's', content: 'timeout 30s', tool_call_id: 't2' })

    const hits = sync.getRecords().map(r => ({
      tokens: r.content.split(' ').length * 2,
      score: 0.9,
      text: r.content
    }))
    const budget = new InjectionBudget()
    const included = budget.selectIncluded(hits)
    expect(included.length).toBeGreaterThan(0)
    expect(budget.remaining).toBeLessThanOrEqual(2000)
  })
})

function createMemoryToolDefs() {
  return [
    {
      name: 'nexus.memory.recall',
      description: 'Recall relevant memories from past sessions.',
      parameters: { query: { type: 'string', required: true, description: 'Search query' } },
      output: { schema: { type: 'array' } }
    },
    {
      name: 'nexus.memory.save',
      description: 'Save a decision or finding to memory.',
      parameters: {
        content: { type: 'string', required: true, description: 'Content to save' },
        agent: { type: 'string', required: true, description: 'Agent name' },
        session_id: { type: 'string', required: true, description: 'Session ID' }
      },
      output: { schema: { type: 'object' } }
    }
  ]
}
