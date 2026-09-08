import { describe, it, expect, vi } from 'vitest'
import { TrajectorySync } from '../src/trajectory-sync.js'
import { sha256Hex } from '@nexus/core'

function auditEvents(spy: ReturnType<typeof vi.fn>): unknown[] {
  return spy.mock.calls.map((c: unknown[]) => c[0])
}

describe('TrajectorySync', () => {
  it('saveTurn 创建 MemoryRecord 并发出 trajectory.saved 审计', () => {
    const auditSink = vi.fn()
    const sync = new TrajectorySync({ auditSink })
    const turn = {
      agent: 'test-agent',
      session_id: 'sess-1',
      content: 'We decided to use Lance format',
      tool_call_id: 'tc-1'
    }
    const record = sync.saveTurn(turn)
    expect(record).not.toBeNull()
    expect(record!.id).toMatch(/^mem-/)
    expect(record!.agent).toBe('test-agent')
    expect(record!.session_id).toBe('sess-1')
    expect(record!.content).toBe(turn.content)
    expect(record!.hash).toBe(sha256Hex(turn.content))
    expect(record!.redacted).toBe(false)
    const events = auditEvents(auditSink)
    expect(events).toHaveLength(1)
    expect((events[0] as Record<string, unknown>).decision).toBe('trajectory.saved')
  })

  it('相同内容的连续 saveTurn 被去重（dedupWindow 内）', () => {
    const auditSink = vi.fn()
    const sync = new TrajectorySync({ dedupWindow: 5, auditSink })
    const turn = { agent: 'a', session_id: 's', content: 'dup', tool_call_id: 't' }
    sync.saveTurn(turn)
    const r2 = sync.saveTurn(turn)
    expect(r2).toBeNull()
    expect(auditEvents(auditSink)).toHaveLength(1)
  })

  it('超过 dedupWindow 后同一内容可再次保存', () => {
    const auditSink = vi.fn()
    const sync = new TrajectorySync({ dedupWindow: 2, auditSink })
    const turn = { agent: 'a', session_id: 's', content: 'same', tool_call_id: 't' }
    sync.saveTurn(turn)
    sync.saveTurn(turn)
    const r3 = sync.saveTurn(turn)
    expect(r3).toBeNull()
  })

  it('不同内容即使同 session 也正常保存', () => {
    const auditSink = vi.fn()
    const sync = new TrajectorySync({ auditSink })
    const base = { agent: 'a', session_id: 's', tool_call_id: 't' }
    const r1 = sync.saveTurn({ ...base, content: 'alpha' })
    const r2 = sync.saveTurn({ ...base, content: 'beta' })
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
    expect(r1!.id).not.toBe(r2!.id)
  })

  it('records 暴露所有已保存的记录（只读快照）', () => {
    const sync = new TrajectorySync({ auditSink: vi.fn() })
    sync.saveTurn({ agent: 'a', session_id: 's', content: 'one', tool_call_id: 't1' })
    sync.saveTurn({ agent: 'a', session_id: 's', content: 'two', tool_call_id: 't2' })
    expect(sync.getRecords()).toHaveLength(2)
    expect(sync.getRecords()[0]!.content).toBe('one')
  })

  it('包含 tool_call_id 与 timestamp', () => {
    const sync = new TrajectorySync({ auditSink: vi.fn() })
    const before = Date.now()
    const record = sync.saveTurn({
      agent: 'a', session_id: 's', content: 'x', tool_call_id: 'tc-99'
    })
    const after = Date.now()
    expect(record).not.toBeNull()
    expect(record!.tool_call_id).toBe('tc-99')
    expect(record!.timestamp).toBeGreaterThanOrEqual(before)
    expect(record!.timestamp).toBeLessThanOrEqual(after)
  })

  it('audit 事件包含 token 和 session_id', () => {
    const auditSink = vi.fn()
    const sync = new TrajectorySync({ auditSink })
    sync.saveTurn({ agent: 'agent-x', session_id: 'sess-42', content: 'hi', tool_call_id: 't' })
    const event = auditEvents(auditSink)[0] as Record<string, unknown>
    expect(event.agent).toBe('agent-x')
    expect(event.session_id).toBe('sess-42')
    expect(typeof event.token).toBe('string')
    expect(event.token).not.toBe('')
  })

  it('dedupWindow=0 禁用去重', () => {
    const sync = new TrajectorySync({ dedupWindow: 0, auditSink: vi.fn() })
    const turn = { agent: 'a', session_id: 's', content: 'x', tool_call_id: 't' }
    sync.saveTurn(turn)
    const r2 = sync.saveTurn(turn)
    expect(r2).not.toBeNull()
    expect(sync.getRecords()).toHaveLength(2)
  })

  it('空内容也正常处理（不崩溃）', () => {
    const sync = new TrajectorySync({ auditSink: vi.fn() })
    const record = sync.saveTurn({ agent: 'a', session_id: 's', content: '', tool_call_id: 't' })
    expect(record).not.toBeNull()
    expect(record!.hash).toBe(sha256Hex(''))
  })
})
