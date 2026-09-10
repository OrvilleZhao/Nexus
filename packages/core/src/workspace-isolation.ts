export interface WorkspaceLock {
  workspace_id: string
  agent: string
  fencing_token: string
  acquired_at: number
}

export type FencingToken = string

let fenceCounter = 0

export class WorkspaceIsolation {
  private readonly locks = new Map<string, WorkspaceLock>()

  acquire(workspace_id: string, agent: string): WorkspaceLock {
    if (this.locks.has(workspace_id)) {
      throw new Error(`workspace ${workspace_id} already locked`)
    }
    fenceCounter++
    const lock: WorkspaceLock = {
      workspace_id,
      agent,
      fencing_token: `fence-${fenceCounter}`,
      acquired_at: Date.now(),
    }
    this.locks.set(workspace_id, lock)
    return lock
  }

  release(workspace_id: string, agent: string): void {
    const lock = this.locks.get(workspace_id)
    if (!lock) throw new Error(`workspace ${workspace_id} not locked`)
    if (lock.agent !== agent) throw new Error(`not owner of workspace ${workspace_id}`)
    this.locks.delete(workspace_id)
  }

  forceRelease(workspace_id: string): void {
    this.locks.delete(workspace_id)
  }

  isLocked(workspace_id: string): boolean {
    return this.locks.has(workspace_id)
  }

  getLock(workspace_id: string): WorkspaceLock | undefined {
    return this.locks.get(workspace_id)
  }

  listLocked(): string[] {
    return [...this.locks.keys()]
  }

  validateFencingToken(workspace_id: string, token: FencingToken): boolean {
    const lock = this.locks.get(workspace_id)
    if (!lock) return false
    return lock.fencing_token === token
  }
}
