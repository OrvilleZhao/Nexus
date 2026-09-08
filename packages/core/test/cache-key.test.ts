import { describe, expect, it } from 'vitest'
import { makeCacheKey, parsePolicyQuery } from '../src/index.js'

const query = {
  request_id: 'req-1',
  policy_version: 'omnigent-policy-v1',
  subject: { kind: 'agent', name: 'nexus-dev-01', session_id: 'sess-1' },
  action: { type: 'tool_call', tool: 'shell', args_meta: { cmd_class: 'file_write' } },
  resource: { type: 'file', path: '/repo/src/main.go' }
}

describe('makeCacheKey', () => {
  it('相同输入 → 相同键', () => {
    expect(makeCacheKey(parsePolicyQuery(query))).toEqual(makeCacheKey(parsePolicyQuery(query)))
  })

  it('subject_hash 与 resource_hash 为 64 位十六进制摘要', () => {
    const key = makeCacheKey(parsePolicyQuery(query))
    expect(key.subject_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(key.resource_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(key.action_tool).toBe('shell')
    expect(key.policy_version).toBe('omnigent-policy-v1')
  })

  it.each([
    ['session_id', { subject: { kind: 'agent', name: 'nexus-dev-01', session_id: 'sess-2' } }],
    ['tool', { action: { type: 'tool_call', tool: 'edit', args_meta: {} } }],
    ['path', { resource: { type: 'file', path: '/repo/src/other.go' } }],
    ['policy_version', { policy_version: 'omnigent-policy-v2' }],
    ['resource 无 path/origin', { resource: { type: 'credential' } }]
  ])('字段 %s 变化 → 键变化', (_field, override) => {
    const baseKey = makeCacheKey(parsePolicyQuery(query))
    const variantKey = makeCacheKey(parsePolicyQuery({ ...query, ...override }))
    expect(variantKey).not.toEqual(baseKey)
  })
})
