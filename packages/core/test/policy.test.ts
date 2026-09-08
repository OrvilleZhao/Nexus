import { describe, expect, it } from 'vitest'
import {
  makeAuditToken,
  makeRequestId,
  parsePolicyDecision,
  parsePolicyQuery,
  SchemaError
} from '../src/index.js'

const validDecision = {
  decision: 'allow',
  reason_code: 'POLICY_RULE_001',
  ttl_seconds: 300,
  audit_token: 'aud-00000000-0000-4000-8000-000000000000'
}

const validQuery = {
  request_id: 'req-1',
  policy_version: 'omnigent-policy-v1',
  subject: { kind: 'agent', name: 'nexus-dev-01', session_id: 'sess-1' },
  action: { type: 'tool_call', tool: 'shell', args_meta: { cmd_class: 'file_write' } },
  resource: { type: 'file', path: '/repo/src/main.go' }
}

describe('parsePolicyDecision', () => {
  it('缺 audit_token → SchemaError', () => {
    const { audit_token: _drop, ...rest } = validDecision
    expect(() => parsePolicyDecision(rest)).toThrowError(SchemaError)
  })

  it('缺 ttl_seconds → SchemaError', () => {
    const { ttl_seconds: _drop, ...rest } = validDecision
    expect(() => parsePolicyDecision(rest)).toThrowError(SchemaError)
  })

  it('decision 非法枚举 → SchemaError', () => {
    expect(() => parsePolicyDecision({ ...validDecision, decision: 'maybe' })).toThrowError(SchemaError)
  })

  it('audit_token 前缀不符 → SchemaError', () => {
    expect(() => parsePolicyDecision({ ...validDecision, audit_token: 'tok-123' })).toThrowError(SchemaError)
  })

  it('合法输入解析成功', () => {
    expect(parsePolicyDecision(validDecision)).toEqual(validDecision)
  })
})

describe('parsePolicyQuery', () => {
  it('缺 request_id → SchemaError', () => {
    const { request_id: _drop, ...rest } = validQuery
    expect(() => parsePolicyQuery(rest)).toThrowError(SchemaError)
  })

  it('resource.type 非法 → SchemaError', () => {
    expect(() => parsePolicyQuery({ ...validQuery, resource: { type: 'database' } })).toThrowError(SchemaError)
  })

  it('request_id 前缀不符 → SchemaError', () => {
    expect(() => parsePolicyQuery({ ...validQuery, request_id: 'query-1' })).toThrowError(SchemaError)
  })

  it('合法输入解析成功', () => {
    expect(parsePolicyQuery(validQuery)).toEqual(validQuery)
  })
})

describe('标识生成器', () => {
  it('makeRequestId 以 req- 开头且为 uuid', () => {
    expect(makeRequestId()).toMatch(/^req-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('makeAuditToken 以 aud- 开头且为 uuid', () => {
    expect(makeAuditToken()).toMatch(/^aud-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
