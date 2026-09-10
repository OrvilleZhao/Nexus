import type { AuditEvent } from './audit.js'

export interface PolicyViolation {
  event: AuditEvent
  reason: string
  rule_id: string
}

export interface PolicyUpdate {
  rule_id: string
  action: 'tighten' | 'relax' | 'suppress'
  count: number
}

export interface PolicyFeedbackConfig {
  threshold: number
}

export class PolicyFeedbackEngine {
  private readonly violations: PolicyViolation[] = []
  private readonly counts = new Map<string, number>()
  private readonly suppressed = new Set<string>()
  private readonly threshold: number

  constructor(config?: PolicyFeedbackConfig) {
    this.threshold = config?.threshold ?? 5
  }

  recordViolation(v: PolicyViolation): void {
    this.violations.push(v)
    this.counts.set(v.rule_id, (this.counts.get(v.rule_id) ?? 0) + 1)
  }

  getViolations(): PolicyViolation[] {
    return [...this.violations]
  }

  getViolationFrequency(): Map<string, number> {
    return new Map(this.counts)
  }

  generateUpdates(): PolicyUpdate[] {
    const updates: PolicyUpdate[] = []
    for (const [rule_id, count] of this.counts) {
      if (this.suppressed.has(rule_id)) continue
      if (count >= this.threshold) {
        updates.push({ rule_id, action: 'tighten', count })
      }
    }
    return updates
  }

  suppressRule(rule_id: string): void {
    this.suppressed.add(rule_id)
  }

  isSuppressed(rule_id: string): boolean {
    return this.suppressed.has(rule_id)
  }

  clear(): void {
    this.violations.length = 0
    this.counts.clear()
  }
}
