import { describe, it, expect } from 'vitest'
import { ProviderStore, PROVIDER_PRESETS } from '../src/ts/providers.js'
import { memoryStorage, uid } from '../src/ts/util.js'

function makeStore() {
  return new ProviderStore(memoryStorage())
}

function makeProvider(overrides: Partial<Parameters<ProviderStore['upsert']>[0]> = {}) {
  return {
    id: uid(),
    name: 'Test Provider',
    apiType: 'openai' as const,
    baseUrl: 'https://api.test.com/v1',
    apiKey: 'sk-test',
    model: 'test-model',
    isDefault: false,
    ...overrides,
  }
}

describe('ProviderStore', () => {
  it('seeds presets with first as default and empty keys', () => {
    const s = makeStore()
    s.seed()
    const list = s.list()
    expect(list.length).toBe(3)
    expect(s.default()?.name).toBe('DeepSeek')
    expect(list.every(p => p.apiKey === '')).toBe(true)
  })

  it('seed is idempotent', () => {
    const s = makeStore()
    s.seed()
    s.seed()
    expect(s.list().length).toBe(3)
  })

  it('upsert enforces single default', () => {
    const s = makeStore()
    const a = makeProvider({ name: 'A', isDefault: true })
    const b = makeProvider({ name: 'B', isDefault: true })
    s.upsert(a)
    s.upsert(b)
    expect(s.list().filter(p => p.isDefault)).toHaveLength(1)
    expect(s.default()?.id).toBe(b.id)
  })

  it('first provider becomes default automatically', () => {
    const s = makeStore()
    const a = makeProvider({ name: 'A' })
    s.upsert(a)
    expect(s.default()?.id).toBe(a.id)
  })

  it('remove reassigns default to first remaining', () => {
    const s = makeStore()
    const a = makeProvider({ name: 'A', isDefault: true })
    const b = makeProvider({ name: 'B' })
    s.upsert(a)
    s.upsert(b)
    s.remove(a.id)
    expect(s.list()).toHaveLength(1)
    expect(s.default()?.id).toBe(b.id)
  })

  it('setDefault toggles exclusively', () => {
    const s = makeStore()
    const a = makeProvider({ name: 'A', isDefault: true })
    const b = makeProvider({ name: 'B' })
    s.upsert(a)
    s.upsert(b)
    s.setDefault(b.id)
    expect(s.get(a.id)?.isDefault).toBe(false)
    expect(s.get(b.id)?.isDefault).toBe(true)
  })

  it('createFromPreset builds provider from preset', () => {
    const s = makeStore()
    const p = s.createFromPreset(0)
    expect(p.name).toBe(PROVIDER_PRESETS[0]!.name)
    expect(p.baseUrl).toBe(PROVIDER_PRESETS[0]!.baseUrl)
    expect(p.apiKey).toBe('')
    expect(s.get(p.id)?.name).toBe(p.name)
  })

  it('createFromPreset out-of-range falls back to custom', () => {
    const s = makeStore()
    const p = s.createFromPreset(99)
    expect(p.name).toBe('Custom (OpenAI-compatible)')
    expect(p.baseUrl).toBe('')
  })

  it('persists across store instances', () => {
    const storage = memoryStorage()
    const s1 = new ProviderStore(storage)
    const a = makeProvider({ name: 'A' })
    s1.upsert(a)
    const s2 = new ProviderStore(storage)
    expect(s2.list()).toHaveLength(1)
    expect(s2.get(a.id)?.name).toBe('A')
  })

  it('survives corrupt storage', () => {
    const storage = memoryStorage()
    storage.setItem('nexus.providers', '{not json')
    const s = new ProviderStore(storage)
    expect(s.list()).toEqual([])
  })
})
