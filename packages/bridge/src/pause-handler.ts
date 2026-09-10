import type { PolicyDecision, PolicyQuery } from '@nexus/core'

export type WriteFileFn = (path: string, data: string) => Promise<void>
export type ReadFileFn = (path: string) => Promise<string>

export interface PauseHandlerOptions {
  dir: string
  writeFile?: WriteFileFn
  readFile?: ReadFileFn
}

export interface PauseResult {
  status: 'pending'
  pendingId: string
}

export class PauseHandler {
  private readonly dir: string
  private readonly writeFile: WriteFileFn
  private readonly readFile: ReadFileFn

  constructor(opts: PauseHandlerOptions) {
    this.dir = opts.dir
    this.writeFile = opts.writeFile ?? defaultWriteFile
    this.readFile = opts.readFile ?? defaultReadFile
  }

  async handle(outcome: { outcome: string; decision: PolicyDecision }, query: PolicyQuery): Promise<PauseResult> {
    const pendingId = `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const data = JSON.stringify({ pendingId, query, decision: outcome.decision, status: 'pending' }, null, 2)
    await this.writeFile(`${this.dir}/${pendingId}.json`, data)
    return { status: 'pending', pendingId }
  }

  async respond(pendingId: string, response: 'approved' | 'denied'): Promise<void> {
    const path = `${this.dir}/${pendingId}.json`
    const raw = await this.readFile(path)
    const data = JSON.parse(raw) as Record<string, unknown>
    data.status = response
    data.respondedAt = new Date().toISOString()
    await this.writeFile(path, JSON.stringify(data, null, 2))
  }

  async getStatus(pendingId: string): Promise<string> {
    try {
      const raw = await this.readFile(`${this.dir}/${pendingId}.json`)
      const data = JSON.parse(raw) as Record<string, unknown>
      return String(data.status ?? 'unknown')
    } catch {
      return 'unknown'
    }
  }
}

async function defaultWriteFile(_path: string, _data: string): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(_path, _data, 'utf-8')
}

async function defaultReadFile(path: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  return readFile(path, 'utf-8')
}
