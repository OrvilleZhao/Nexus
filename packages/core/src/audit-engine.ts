import type { AuditEvent } from './audit.js'

export interface AuditSessionSummary {
  total: number
  allow: number
  deny: number
  failClosed: number
  paused: number
  toolCalls: Record<string, number>
}

export interface AuditAgentSummary extends AuditSessionSummary {
  sessions: string[]
}

export class AuditEngine {
  private readonly events: AuditEvent[] = []

  record(event: AuditEvent): void {
    this.events.push(event)
  }

  queryBySession(sessionId: string): AuditEvent[] {
    return this.events.filter(e => e.session_id === sessionId)
  }

  queryByAgent(agentName: string): AuditEvent[] {
    return this.events.filter(e => e.agent === agentName)
  }

  summaryBySession(sessionId: string): AuditSessionSummary {
    return buildSummary(this.queryBySession(sessionId))
  }

  summaryByAgent(agentName: string): AuditAgentSummary {
    const events = this.queryByAgent(agentName)
    const sessions = [...new Set(events.map(e => e.session_id))]
    return { ...buildSummary(events), sessions }
  }
}

function buildSummary(events: AuditEvent[]): AuditSessionSummary {
  const toolCalls: Record<string, number> = {}
  let allow = 0
  let deny = 0
  let failClosed = 0
  let paused = 0

  for (const e of events) {
    switch (e.decision) {
      case 'allow': allow++; break
      case 'deny': deny++; break
      case 'fail_closed': failClosed++; break
      case 'pause': paused++; break
    }
    toolCalls[e.tool_call] = (toolCalls[e.tool_call] ?? 0) + 1
  }

  return { total: events.length, allow, deny, failClosed, paused, toolCalls }
}
