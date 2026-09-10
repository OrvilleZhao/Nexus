import { describe, it, expect, vi } from 'vitest'
import { SneeEmitter } from '../src/sne-emitter.js'
import { makeEnvelope } from '../src/sne.js'

describe('SneeEmitter', () => {
  it('on + emit 触发匹配 kind 的监听器', () => {
    const emitter = new SneeEmitter()
    const handler = vi.fn()
    emitter.on('tool_call', handler)
    const env = makeEnvelope({ name: 'a', session_id: 's' }, { kind: 'tool_call', query: {
      request_id: 'req-1', policy_version: 'v1',
      subject: { kind: 'agent', name: 'a', session_id: 's' },
      action: { type: 'tool_call', tool: 't', args_meta: {} },
      resource: { type: 'memory' }
    }})
    emitter.emit(env)
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(env)
  })

  it('不匹配 kind 的监听器不触发', () => {
    const emitter = new SneeEmitter()
    const handler = vi.fn()
    emitter.on('memory.recall', handler)
    const env = makeEnvelope({ name: 'a', session_id: 's' }, { kind: 'tool_call', query: {
      request_id: 'req-1', policy_version: 'v1',
      subject: { kind: 'agent', name: 'a', session_id: 's' },
      action: { type: 'tool_call', tool: 't', args_meta: {} },
      resource: { type: 'memory' }
    }})
    emitter.emit(env)
    expect(handler).not.toHaveBeenCalled()
  })

  it('通配符 * 监听所有事件', () => {
    const emitter = new SneeEmitter()
    const handler = vi.fn()
    emitter.on('*', handler)
    const env = makeEnvelope({ name: 'a', session_id: 's' }, { kind: 'audit.beat', event: {
      agent: 'a', session_id: 's', tool_call: 'tc', decision: 'allow', token: 'aud-1'
    }})
    emitter.emit(env)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('off 移除监听器', () => {
    const emitter = new SneeEmitter()
    const handler = vi.fn()
    emitter.on('tool_call', handler)
    emitter.off('tool_call', handler)
    const env = makeEnvelope({ name: 'a', session_id: 's' }, { kind: 'tool_call', query: {
      request_id: 'req-1', policy_version: 'v1',
      subject: { kind: 'agent', name: 'a', session_id: 's' },
      action: { type: 'tool_call', tool: 't', args_meta: {} },
      resource: { type: 'memory' }
    }})
    emitter.emit(env)
    expect(handler).not.toHaveBeenCalled()
  })

  it('多个监听器按注册顺序触发', () => {
    const emitter = new SneeEmitter()
    const order: number[] = []
    emitter.on('tool_call', () => order.push(1))
    emitter.on('tool_call', () => order.push(2))
    emitter.on('tool_call', () => order.push(3))
    const env = makeEnvelope({ name: 'a', session_id: 's' }, { kind: 'tool_call', query: {
      request_id: 'req-1', policy_version: 'v1',
      subject: { kind: 'agent', name: 'a', session_id: 's' },
      action: { type: 'tool_call', tool: 't', args_meta: {} },
      resource: { type: 'memory' }
    }})
    emitter.emit(env)
    expect(order).toEqual([1, 2, 3])
  })

  it('listenerCount 返回当前监听器数量', () => {
    const emitter = new SneeEmitter()
    expect(emitter.listenerCount('tool_call')).toBe(0)
    const h = vi.fn()
    emitter.on('tool_call', h)
    expect(emitter.listenerCount('tool_call')).toBe(1)
    emitter.off('tool_call', h)
    expect(emitter.listenerCount('tool_call')).toBe(0)
  })
})
