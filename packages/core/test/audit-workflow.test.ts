import { describe, it, expect } from 'vitest'
import { AuditWorkflow, type AuditFinding } from '../src/audit-workflow.js'
import type { AuditEvent } from '../src/audit.js'

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    agent: 'test-agent',
    session_id: 's1',
    tool_call: 'bash',
    decision: 'allow',
    token: 'aud-001',
    ...overrides,
  }
}

describe('AuditWorkflow', () => {
  it('runs all 5 stages in order and returns a report', () => {
    const stages: string[] = []
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events: unknown[]) => { stages.push('recon'); return { findings: [], events }; } },
        { name: 'architect', run: (events: unknown[]) => { stages.push('architect'); return { findings: [], events }; } },
        { name: 'sast', run: (events: unknown[]) => { stages.push('sast'); return { findings: [], events }; } },
        { name: 'judge', run: (_events: unknown[], findings: AuditFinding[]) => { stages.push('judge'); return { findings, verdict: 'pass' }; } },
        { name: 'reporter', run: (_events: unknown[], findings: AuditFinding[], verdict: string) => { stages.push('reporter'); return { findings, verdict, summary: 'ok' }; } },
      ],
    })
    const report = workflow.execute([makeEvent()])
    expect(stages).toEqual(['recon', 'architect', 'sast', 'judge', 'reporter'])
    expect(report.verdict).toBe('pass')
    expect(report.findings).toEqual([])
  })

  it('recon stage normalizes events', () => {
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events) => ({ findings: [], events: (events as AuditEvent[]).map((e: AuditEvent) => ({ ...e, normalized: true })) }) },
        { name: 'judge', run: (_e: unknown, f: AuditFinding[]) => ({ findings: f, verdict: 'pass' }) },
        { name: 'reporter', run: (_e: unknown, f: AuditFinding[], v: string) => ({ findings: f, verdict: v, summary: 'ok' }) },
      ],
    })
    const report = workflow.execute([makeEvent()])
    expect(report.events).toHaveLength(1)
    expect((report.events[0] as Record<string, unknown>).normalized).toBe(true)
  })

  it('architect stage detects cross-layer violations', () => {
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events: unknown[]) => ({ findings: [], events }) },
        {
          name: 'architect',
          run: (events: unknown[]) => {
            const findings: AuditFinding[] = (events as AuditEvent[])
              .filter((e: AuditEvent) => e.tool_call === 'bridge.internal')
              .map((e: AuditEvent) => ({ severity: 'high' as const, stage: 'architect', message: `cross-layer call: ${e.tool_call}`, event: e }))
            return { findings, events }
          },
        },
        { name: 'sast', run: (events: unknown[]) => ({ findings: [], events }) },
        { name: 'judge', run: (_e: unknown, f: AuditFinding[]) => ({ findings: f, verdict: f.length > 0 ? 'fail' : 'pass' }) },
        { name: 'reporter', run: (_e: unknown, f: AuditFinding[], v: string) => ({ findings: f, verdict: v, summary: `${f.length} findings` }) },
      ],
    })
    const report = workflow.execute([
      makeEvent({ tool_call: 'bridge.internal' }),
      makeEvent({ tool_call: 'bash' }),
    ])
    expect(report.verdict).toBe('fail')
    expect(report.findings).toHaveLength(1)
    expect(report.findings[0]!.stage).toBe('architect')
  })

  it('sast stage detects security issues', () => {
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events: unknown[]) => ({ findings: [], events }) },
        { name: 'architect', run: (events: unknown[]) => ({ findings: [], events }) },
        {
          name: 'sast',
          run: (events: unknown[]) => {
            const findings: AuditFinding[] = (events as AuditEvent[])
              .filter((e: AuditEvent) => e.decision === 'allow' && e.tool_call.includes('rm'))
              .map((e: AuditEvent) => ({ severity: 'critical' as const, stage: 'sast', message: `dangerous command: ${e.tool_call}`, event: e }))
            return { findings, events }
          },
        },
        { name: 'judge', run: (_e: unknown, f: AuditFinding[]) => ({ findings: f, verdict: f.some((x: AuditFinding) => x.severity === 'critical') ? 'fail' : 'pass' }) },
        { name: 'reporter', run: (_e: unknown, f: AuditFinding[], v: string) => ({ findings: f, verdict: v, summary: `${f.length} issues` }) },
      ],
    })
    const report = workflow.execute([makeEvent({ tool_call: 'rm -rf /' })])
    expect(report.verdict).toBe('fail')
    expect(report.findings[0]!.severity).toBe('critical')
  })

  it('judge aggregates findings and sets verdict', () => {
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events: unknown[]) => ({ findings: [], events }) },
        { name: 'architect', run: (events: unknown[]) => ({ findings: [{ severity: 'low' as const, stage: 'architect', message: 'minor', event: events[0] }], events }) },
        { name: 'sast', run: (events: unknown[]) => ({ findings: [], events }) },
        {
          name: 'judge',
          run: (_events: unknown[], findings: AuditFinding[]) => {
            const critCount = findings.filter((f: AuditFinding) => f.severity === 'critical').length
            const highCount = findings.filter((f: AuditFinding) => f.severity === 'high').length
            if (critCount > 0) return { findings, verdict: 'fail' }
            if (highCount > 0) return { findings, verdict: 'warn' }
            return { findings, verdict: 'pass' }
          },
        },
        { name: 'reporter', run: (_e: unknown, f: AuditFinding[], v: string) => ({ findings: f, verdict: v, summary: 'done' }) },
      ],
    })
    const report = workflow.execute([makeEvent()])
    expect(report.verdict).toBe('pass')
  })

  it('reporter generates summary text', () => {
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events: unknown[]) => ({ findings: [], events }) },
        { name: 'architect', run: (events: unknown[]) => ({ findings: [], events }) },
        { name: 'sast', run: (events: unknown[]) => ({ findings: [], events }) },
        { name: 'judge', run: (_e: unknown, f: AuditFinding[]) => ({ findings: f, verdict: 'pass' }) },
        {
          name: 'reporter',
          run: (events: unknown[], findings: AuditFinding[], verdict: string) => ({
            findings,
            verdict,
            summary: `Scanned ${events.length} events, ${findings.length} findings, verdict: ${verdict}`,
          }),
        },
      ],
    })
    const report = workflow.execute([makeEvent(), makeEvent({ tool_call: 'ls' })])
    expect(report.summary).toBe('Scanned 2 events, 0 findings, verdict: pass')
  })

  it('stages can be skipped or replaced', () => {
    const order: string[] = []
    const workflow = new AuditWorkflow({
      stages: [
          { name: 'recon', run: (events: unknown[]) => { order.push('recon'); return { findings: [], events }; } },
          { name: 'sast', run: (events: unknown[]) => { order.push('sast'); return { findings: [], events }; } },
          { name: 'reporter', run: (_e: unknown, f: AuditFinding[]) => { order.push('reporter'); return { findings: f, verdict: 'pass', summary: 'done' }; } },
      ],
    })
    workflow.execute([makeEvent()])
    expect(order).toEqual(['recon', 'sast', 'reporter'])
  })

  it('empty events still produces a valid report', () => {
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events: unknown[]) => ({ findings: [], events }) },
        { name: 'judge', run: (_e: unknown, f: AuditFinding[]) => ({ findings: f, verdict: 'pass' }) },
        { name: 'reporter', run: (_e: unknown, f: AuditFinding[], v: string) => ({ findings: f, verdict: v, summary: 'no events' }) },
      ],
    })
    const report = workflow.execute([])
    expect(report.verdict).toBe('pass')
    expect(report.summary).toBe('no events')
  })

  it('passes context between stages', () => {
    const ctx: Record<string, unknown> = {}
    const workflow = new AuditWorkflow({
      stages: [
        { name: 'recon', run: (events: unknown[]) => { ctx.reconCount = events.length; return { findings: [], events } } },
        { name: 'architect', run: (events: unknown[]) => { ctx.architectRan = true; return { findings: [], events } } },
        { name: 'judge', run: (_e: unknown, f: AuditFinding[]) => ({ findings: f, verdict: 'pass', context: ctx }) },
        { name: 'reporter', run: (_e: unknown, f: AuditFinding[], v: string, c: Record<string, unknown>) => ({ findings: f, verdict: v, summary: `ctx: ${JSON.stringify(c)}` }) },
      ],
    })
    const report = workflow.execute([makeEvent()])
    expect(report.summary).toContain('"reconCount":1')
    expect(report.summary).toContain('"architectRan":true')
  })
})
