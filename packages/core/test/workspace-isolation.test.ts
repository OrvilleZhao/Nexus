import { describe, it, expect } from 'vitest'
import {
  WorkspaceIsolation,
} from '../src/workspace-isolation.js'

describe('WorkspaceIsolation', () => {
  it('acquires lock for a workspace', () => {
    const iso = new WorkspaceIsolation()
    const lock = iso.acquire('ws-1', 'agent-a')
    expect(lock.workspace_id).toBe('ws-1')
    expect(lock.agent).toBe('agent-a')
    expect(lock.fencing_token).toMatch(/^fence-/)
  })

  it('rejects second lock on same workspace', () => {
    const iso = new WorkspaceIsolation()
    iso.acquire('ws-1', 'agent-a')
    expect(() => iso.acquire('ws-1', 'agent-b')).toThrow('already locked')
  })

  it('allows locks on different workspaces', () => {
    const iso = new WorkspaceIsolation()
    iso.acquire('ws-1', 'agent-a')
    iso.acquire('ws-2', 'agent-b')
    expect(iso.isLocked('ws-1')).toBe(true)
    expect(iso.isLocked('ws-2')).toBe(true)
  })

  it('releases lock', () => {
    const iso = new WorkspaceIsolation()
    iso.acquire('ws-1', 'agent-a')
    iso.release('ws-1', 'agent-a')
    expect(iso.isLocked('ws-1')).toBe(false)
  })

  it('only owner can release', () => {
    const iso = new WorkspaceIsolation()
    iso.acquire('ws-1', 'agent-a')
    expect(() => iso.release('ws-1', 'agent-b')).toThrow('not owner')
    expect(iso.isLocked('ws-1')).toBe(true)
  })

  it('fencing token increments on re-acquire', () => {
    const iso = new WorkspaceIsolation()
    const t1 = iso.acquire('ws-1', 'agent-a')
    iso.release('ws-1', 'agent-a')
    const t2 = iso.acquire('ws-1', 'agent-a')
    expect(Number(t2.fencing_token.split('-')[1])).toBeGreaterThan(
      Number(t1.fencing_token.split('-')[1])
    )
  })

  it('validateFencingToken checks token matches lock', () => {
    const iso = new WorkspaceIsolation()
    const lock = iso.acquire('ws-1', 'agent-a')
    expect(iso.validateFencingToken('ws-1', lock.fencing_token)).toBe(true)
    expect(iso.validateFencingToken('ws-1', 'fence-0')).toBe(false)
  })

  it('returns lock info', () => {
    const iso = new WorkspaceIsolation()
    iso.acquire('ws-1', 'agent-a')
    const info = iso.getLock('ws-1')
    expect(info).toBeDefined()
    expect(info!.agent).toBe('agent-a')
  })

  it('returns undefined for unlocked workspace', () => {
    const iso = new WorkspaceIsolation()
    expect(iso.getLock('ws-1')).toBeUndefined()
  })

  it('lists all locked workspaces', () => {
    const iso = new WorkspaceIsolation()
    iso.acquire('ws-1', 'agent-a')
    iso.acquire('ws-2', 'agent-b')
    expect(iso.listLocked()).toEqual(['ws-1', 'ws-2'])
  })

  it('force release by admin', () => {
    const iso = new WorkspaceIsolation()
    iso.acquire('ws-1', 'agent-a')
    iso.forceRelease('ws-1')
    expect(iso.isLocked('ws-1')).toBe(false)
  })
})
