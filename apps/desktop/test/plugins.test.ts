import { describe, it, expect } from 'vitest'
import { PluginStore, BUILTIN_PLUGINS } from '../src/ts/plugins.js'
import { memoryStorage } from '../src/ts/util.js'

describe('PluginStore', () => {
  it('exposes builtin plugin definitions', () => {
    const s = new PluginStore(memoryStorage())
    const ids = s.defs().map(d => d.id)
    expect(ids).toContain('nexus.audit.log')
    expect(ids).toContain('nexus.memory.recall')
  })

  it('returns default enabled state before any toggle', () => {
    const s = new PluginStore(memoryStorage())
    const audit = BUILTIN_PLUGINS.find(p => p.id === 'nexus.audit.log')!
    const verbose = BUILTIN_PLUGINS.find(p => p.id === 'nexus.terminal.verbose')!
    expect(s.isEnabled(audit.id)).toBe(audit.defaultEnabled)
    expect(s.isEnabled(verbose.id)).toBe(verbose.defaultEnabled)
  })

  it('toggle flips and persists state', () => {
    const storage = memoryStorage()
    const s = new PluginStore(storage)
    const before = s.isEnabled('nexus.terminal.verbose')
    const after = s.toggle('nexus.terminal.verbose')
    expect(after).toBe(!before)
    const s2 = new PluginStore(storage)
    expect(s2.isEnabled('nexus.terminal.verbose')).toBe(after)
  })

  it('backend-required plugins are locked', () => {
    const s = new PluginStore(memoryStorage())
    expect(s.isLocked('nexus.memory.recall')).toBe(true)
    expect(s.isLocked('nexus.audit.log')).toBe(false)
  })

  it('setEnabled is a no-op for locked plugins', () => {
    const s = new PluginStore(memoryStorage())
    const before = s.isEnabled('nexus.memory.recall')
    s.setEnabled('nexus.memory.recall', !before)
    expect(s.isEnabled('nexus.memory.recall')).toBe(before)
  })

  it('unknown plugin ids are disabled and unlocked', () => {
    const s = new PluginStore(memoryStorage())
    expect(s.isEnabled('nexus.unknown')).toBe(false)
    expect(s.isLocked('nexus.unknown')).toBe(false)
  })

  it('survives corrupt storage', () => {
    const storage = memoryStorage()
    storage.setItem('nexus.plugins', '[1,2,3]')
    const s = new PluginStore(storage)
    expect(s.isEnabled('nexus.audit.log')).toBe(true)
  })
})
