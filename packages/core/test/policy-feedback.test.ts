import { describe, it, expect } from 'vitest'
import {
  PolicyFeedbackEngine,
  type PolicyViolation,
} from '../src/policy-feedback.js'
import type { AuditEvent } from '../src/audit.js'

function makeViolation(overrides: Partial<PolicyViolation> = {}): PolicyViolation {
  return {
    event: {
      agent: 'test-agent',
      session_id: 's1',
      tool_call: 'bash',
      decision: 'deny',
      token: 'aud-001',
    } as AuditEvent,
    reason: 'static rule blocked',
    rule_id: 'block-rm',
    ...overrides,
  }
}

describe('PolicyFeedbackEngine', () => {
  it('records violations', () => {
    const engine = new PolicyFeedbackEngine()
    engine.recordViolation(makeViolation())
    expect(engine.getViolations()).toHaveLength(1)
  })

  it('tracks all violations (including repeats)', () => {
    const engine = new PolicyFeedbackEngine()
    engine.recordViolation(makeViolation({ rule_id: 'r1' }))
    engine.recordViolation(makeViolation({ rule_id: 'r1' }))
    expect(engine.getViolations()).toHaveLength(2)
  })

  it('counts violation frequency', () => {
    const engine = new PolicyFeedbackEngine()
    engine.recordViolation(makeViolation({ rule_id: 'r1' }))
    engine.recordViolation(makeViolation({ rule_id: 'r1' }))
    engine.recordViolation(makeViolation({ rule_id: 'r2' }))
    const freq = engine.getViolationFrequency()
    expect(freq.get('r1')).toBe(2)
    expect(freq.get('r2')).toBe(1)
  })

  it('generates policy updates when threshold exceeded', () => {
    const engine = new PolicyFeedbackEngine({ threshold: 3 })
    for (let i = 0; i < 5; i++) {
      engine.recordViolation(makeViolation({ rule_id: 'r1' }))
    }
    const updates = engine.generateUpdates()
    expect(updates).toHaveLength(1)
    expect(updates[0]!.rule_id).toBe('r1')
    expect(updates[0]!.action).toBe('tighten')
    expect(updates[0]!.count).toBe(5)
  })

  it('does not generate updates below threshold', () => {
    const engine = new PolicyFeedbackEngine({ threshold: 5 })
    for (let i = 0; i < 3; i++) {
      engine.recordViolation(makeViolation({ rule_id: 'r1' }))
    }
    expect(engine.generateUpdates()).toHaveLength(0)
  })

  it('supports suppress action', () => {
    const engine = new PolicyFeedbackEngine({ threshold: 2 })
    engine.recordViolation(makeViolation({ rule_id: 'noisy-rule' }))
    engine.recordViolation(makeViolation({ rule_id: 'noisy-rule' }))
    const updates = engine.generateUpdates()
    expect(updates[0]!.action).toBe('tighten')
    // manually suppress
    engine.suppressRule('noisy-rule')
    expect(engine.isSuppressed('noisy-rule')).toBe(true)
  })

  it('suppressed rules are excluded from future updates', () => {
    const engine = new PolicyFeedbackEngine({ threshold: 1 })
    engine.recordViolation(makeViolation({ rule_id: 'r1' }))
    engine.suppressRule('r1')
    const updates = engine.generateUpdates()
    expect(updates).toHaveLength(0)
  })

  it('clears violations', () => {
    const engine = new PolicyFeedbackEngine()
    engine.recordViolation(makeViolation())
    engine.clear()
    expect(engine.getViolations()).toHaveLength(0)
  })

  it('returns empty updates when no violations', () => {
    const engine = new PolicyFeedbackEngine()
    expect(engine.generateUpdates()).toHaveLength(0)
  })
})
