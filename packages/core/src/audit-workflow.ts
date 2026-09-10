export interface AuditFinding {
  severity: 'low' | 'medium' | 'high' | 'critical'
  stage: string
  message: string
  event?: unknown
}

export interface AuditStageResult {
  findings?: AuditFinding[]
  events?: unknown[]
  verdict?: string
  summary?: string
  context?: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StageFn = (...args: any[]) => AuditStageResult

export interface AuditStage {
  name: string
  run: StageFn
}

export interface AuditReport {
  events: unknown[]
  findings: AuditFinding[]
  verdict: string
  summary: string
  context?: Record<string, unknown>
}

export interface AuditWorkflowConfig {
  stages: AuditStage[]
}

export class AuditWorkflow {
  private readonly stages: AuditStage[]

  constructor(config: AuditWorkflowConfig) {
    this.stages = config.stages
  }

  execute(events: unknown[]): AuditReport {
    let currentEvents = events
    const allFindings: AuditFinding[] = []
    const context: Record<string, unknown> = {}
    let verdict = 'pass'
    let summary = ''

    for (const stage of this.stages) {
      let result: AuditStageResult

      switch (stage.name) {
        case 'judge':
          result = stage.run(currentEvents, allFindings)
          break
        case 'reporter':
          result = stage.run(currentEvents, allFindings, verdict, context)
          break
        default:
          result = stage.run(currentEvents)
          break
      }

      if (result.events) currentEvents = result.events
      if (result.findings) {
        for (const f of result.findings) {
          if (!allFindings.some(af => af.stage === f.stage && af.message === f.message)) {
            allFindings.push(f)
          }
        }
      }
      if (result.verdict !== undefined) verdict = result.verdict
      if (result.summary !== undefined) summary = result.summary
      if (result.context !== undefined) Object.assign(context, result.context)
    }

    return { events: currentEvents, findings: allFindings, verdict, summary, context }
  }
}
