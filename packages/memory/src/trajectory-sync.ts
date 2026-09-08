import { makeAuditToken, sha256Hex, type AuditEvent } from '@nexus/core'

export interface TrajectoryTurn {
  agent: string
  session_id: string
  content: string
  tool_call_id: string
}

export interface MemoryRecord {
  id: string
  agent: string
  session_id: string
  timestamp: number
  content: string
  hash: string
  tool_call_id: string
  redacted: boolean
}

export interface TrajectorySyncOptions {
  dedupWindow?: number
  auditSink?: (event: AuditEvent) => void
}

export class TrajectorySync {
  private records: MemoryRecord[] = []
  private readonly dedupWindow: number
  private readonly auditSink: (event: AuditEvent) => void

  constructor(opts: TrajectorySyncOptions = {}) {
    this.dedupWindow = opts.dedupWindow ?? 5
    this.auditSink = opts.auditSink ?? (() => {})
  }

  saveTurn(turn: TrajectoryTurn): MemoryRecord | null {
    const hash = sha256Hex(turn.content)
    if (this.dedupWindow > 0) {
      const recent = this.records.slice(-this.dedupWindow)
      if (recent.some(r => r.hash === hash)) return null
    }

    const record: MemoryRecord = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agent: turn.agent,
      session_id: turn.session_id,
      timestamp: Date.now(),
      content: turn.content,
      hash,
      tool_call_id: turn.tool_call_id,
      redacted: false
    }
    this.records.push(record)

    this.auditSink({
      agent: turn.agent,
      session_id: turn.session_id,
      tool_call: turn.tool_call_id,
      decision: 'trajectory.saved',
      token: makeAuditToken()
    })

    return record
  }

  getRecords(): readonly MemoryRecord[] { return this.records }
}
