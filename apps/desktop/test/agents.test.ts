import { describe, it, expect } from 'vitest'
import { AgentStore } from '../src/ts/agents.js'
import { memoryStorage, uid } from '../src/ts/util.js'

function makeStore() {
  return new AgentStore(memoryStorage())
}

function makeAgent(overrides: Partial<Parameters<AgentStore['upsert']>[0]> = {}) {
  return {
    id: uid(),
    name: 'Test Agent',
    systemPrompt: 'You are a test.',
    providerId: 'p1',
    model: '',
    ...overrides,
  }
}

describe('AgentStore', () => {
  it('seeds a General Assistant bound to default provider', () => {
    const s = makeStore()
    s.seed('p-default')
    const list = s.list()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('General Assistant')
    expect(list[0]!.providerId).toBe('p-default')
  })

  it('seed is idempotent', () => {
    const s = makeStore()
    s.seed('p1')
    s.seed('p2')
    expect(s.list()).toHaveLength(1)
    expect(s.list()[0]!.providerId).toBe('p1')
  })

  it('upsert inserts then updates', () => {
    const s = makeStore()
    const a = makeAgent()
    s.upsert(a)
    expect(s.list()).toHaveLength(1)
    s.upsert({ ...a, name: 'Renamed' })
    expect(s.list()).toHaveLength(1)
    expect(s.get(a.id)?.name).toBe('Renamed')
  })

  it('remove deletes agent', () => {
    const s = makeStore()
    const a = makeAgent()
    s.upsert(a)
    s.remove(a.id)
    expect(s.list()).toHaveLength(0)
    expect(s.get(a.id)).toBeUndefined()
  })

  it('persists across store instances', () => {
    const storage = memoryStorage()
    const a = makeAgent({ name: 'Persistent' })
    new AgentStore(storage).upsert(a)
    const s2 = new AgentStore(storage)
    expect(s2.get(a.id)?.name).toBe('Persistent')
  })
})
