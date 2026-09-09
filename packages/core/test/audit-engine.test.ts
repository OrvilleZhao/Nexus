import { describe, it, expect } from 'vitest'
import { AuditEngine } from '../src/audit-engine.js'
import type { AuditEvent } from '../src/audit.js'

function ev(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    agent: 'agent-a',
    session_id: 'sess-1',
    tool_call: 'tc-1',
    decision: 'allow',
    token: 'aud-1',
    ...overrides
  }
}

describe('AuditEngine', () => {
  it('record 存入事件，queryBySession 按 session_id 检索', () => {
    const engine = new AuditEngine()
    engine.record(ev({ session_id: 'sess-1', tool_call: 'tc-1' }))
    engine.record(ev({ session_id: 'sess-1', tool_call: 'tc-2' }))
    engine.record(ev({ session_id: 'sess-2', tool_call: 'tc-3' }))
    expect(engine.queryBySession('sess-1')).toHaveLength(2)
    expect(engine.queryBySession('sess-2')).toHaveLength(1)
    expect(engine.queryBySession('sess-none')).toHaveLength(0)
  })

  it('queryByAgent 按 agent 跨 session 检索', () => {
    const engine = new AuditEngine()
    engine.record(ev({ agent: 'alice', session_id: 's1' }))
    engine.record(ev({ agent: 'alice', session_id: 's2' }))
    engine.record(ev({ agent: 'bob', session_id: 's1' }))
    expect(engine.queryByAgent('alice')).toHaveLength(2)
    expect(engine.queryByAgent('bob')).toHaveLength(1)
  })

  it('summaryBySession 返回统计摘要', () => {
    const engine = new AuditEngine()
    engine.record(ev({ session_id: 's1', decision: 'allow' }))
    engine.record(ev({ session_id: 's1', decision: 'deny' }))
    engine.record(ev({ session_id: 's1', decision: 'fail_closed' }))
    const summary = engine.summaryBySession('s1')
    expect(summary.total).toBe(3)
    expect(summary.allow).toBe(1)
    expect(summary.deny).toBe(1)
    expect(summary.failClosed).toBe(1)
  })

  it('summaryByAgent 返回跨 session 统计', () => {
    const engine = new AuditEngine()
    engine.record(ev({ agent: 'a', session_id: 's1', decision: 'allow' }))
    engine.record(ev({ agent: 'a', session_id: 's2', decision: 'deny' }))
    const summary = engine.summaryByAgent('a')
    expect(summary.total).toBe(2)
    expect(summary.allow).toBe(1)
    expect(summary.deny).toBe(1)
    expect(summary.sessions).toContain('s1')
    expect(summary.sessions).toContain('s2')
  })

  it('空引擎返回空摘要', () => {
    const engine = new AuditEngine()
    expect(engine.queryBySession('x')).toHaveLength(0)
    expect(engine.summaryBySession('x').total).toBe(0)
    expect(engine.summaryByAgent('x').total).toBe(0)
  })

  it('toolCalls 统计各工具调用次数', () => {
    const engine = new AuditEngine()
    engine.record(ev({ tool_call: 'tc-1' }))
    engine.record(ev({ tool_call: 'tc-1' }))
    engine.record(ev({ tool_call: 'tc-2' }))
    const summary = engine.summaryBySession('sess-1')
    expect(summary.toolCalls).toEqual({ 'tc-1': 2, 'tc-2': 1 })
  })

  it('queryBySession 返回按时间正序', () => {
    const engine = new AuditEngine()
    engine.record(ev({ tool_call: 'first' }))
    engine.record(ev({ tool_call: 'second' }))
    const results = engine.queryBySession('sess-1')
    expect(results[0]!.tool_call).toBe('first')
    expect(results[1]!.tool_call).toBe('second')
  })
})
