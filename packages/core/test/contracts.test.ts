import { describe, it, expect } from 'vitest'
import {
  DshContractSchema,
  validateDshPayload,
  validateFunesPayload,
  validatePdpPayload,
  type DshToolCall,
  type FunesRecallResult,
  type PdpQueryResponse,
} from '../src/contracts.js'

describe('Upstream contract schemas', () => {
  describe('DSH contract', () => {
    const validToolCall: DshToolCall = {
      tool: 'bash',
      args: ['ls', '-la'],
      session_id: 's1',
      agent: 'agent-1',
      call_id: 'c1',
    }

    it('validates a correct tool call', () => {
      expect(validateDshPayload(validToolCall).ok).toBe(true)
    })

    it('rejects empty tool name', () => {
      expect(validateDshPayload({ ...validToolCall, tool: '' }).ok).toBe(false)
    })

    it('rejects missing session_id', () => {
      const { session_id: _, ...noSession } = validToolCall
      expect(validateDshPayload(noSession).ok).toBe(false)
    })

    it('JSON Schema exports correctly', () => {
      expect(DshContractSchema).toHaveProperty('properties.tool')
    })
  })

  describe('Funes contract', () => {
    const validResult: FunesRecallResult = {
      turns: [
        {
          turn_id: 't1',
          session_id: 's1',
          content: 'how to deploy',
          score: 0.92,
          ts: 1700000000000,
        },
      ],
      total: 1,
    }

    it('validates a correct recall result', () => {
      expect(validateFunesPayload(validResult).ok).toBe(true)
    })

    it('rejects negative total', () => {
      expect(validateFunesPayload({ ...validResult, total: -1 }).ok).toBe(false)
    })

    it('rejects turn with score > 1', () => {
      const bad = { ...validResult, turns: [{ ...validResult.turns[0], score: 1.5 }] }
      expect(validateFunesPayload(bad).ok).toBe(false)
    })

    it('allows empty turns array', () => {
      expect(validateFunesPayload({ turns: [], total: 0 }).ok).toBe(true)
    })
  })

  describe('PDP contract', () => {
    const validResponse: PdpQueryResponse = {
      decision: 'allow',
      policy_version: 'p1',
      reason: 'static rule matched',
      ttl: 300,
    }

    it('validates a correct PDP response', () => {
      expect(validatePdpPayload(validResponse).ok).toBe(true)
    })

    it('validates deny decision', () => {
      expect(validatePdpPayload({ ...validResponse, decision: 'deny', reason: 'blocked' }).ok).toBe(true)
    })

    it('validates pause decision', () => {
      expect(validatePdpPayload({ ...validResponse, decision: 'pause', reason: 'needs approval' }).ok).toBe(true)
    })

    it('rejects invalid decision', () => {
      expect(validatePdpPayload({ ...validResponse, decision: 'maybe' }).ok).toBe(false)
    })

    it('rejects missing policy_version', () => {
      const { policy_version: _, ...noPv } = validResponse
      expect(validatePdpPayload(noPv).ok).toBe(false)
    })

    it('allows zero ttl', () => {
      expect(validatePdpPayload({ ...validResponse, ttl: 0 }).ok).toBe(true)
    })
  })
})
