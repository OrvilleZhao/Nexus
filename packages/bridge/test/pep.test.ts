import { describe, expect, it } from 'vitest'
import type { AuditEvent } from '@nexus/core'
import { MockPdp } from '@nexus/contracts'
import { Pep } from '../src/index.js'
import type { StaticRule } from '../src/index.js'
import { allowDecision, auditCollector, baseQuery, denyDecision, pauseDecision, q } from './fixtures.js'

describe('Pep.intercept —— 质询路径', () => {
  it.each([
    ['shell/file_write', q()],
    [
      'network 出站',
      q({
        action: { type: 'tool_call', tool: 'curl', args_meta: { cmd_class: 'net_out' } },
        resource: { type: 'network', origin: 'https://example.com' }
      })
    ],
    [
      '文件删除',
      q({
        action: { type: 'tool_call', tool: 'rm', args_meta: { cmd_class: 'file_delete' } },
        request_id: 'req-rm'
      })
    ]
  ])('敏感操作（%s）→ 质询 PDP 并执行', async (_label, query) => {
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const pep = new Pep({ pdp })
    const out = await pep.intercept(query)
    expect(pdp.callCount).toBe(1)
    expect(out.outcome).toBe('execute')
    expect(out.decision.audit_token).toBe('aud-allow-1')
  })

  it('默认 timeoutMs = 2000 传递给 PDP', async () => {
    const pdp = new MockPdp({ decisions: [allowDecision] })
    await new Pep({ pdp }).intercept(q())
    expect(pdp.optsLog[0]?.timeoutMs).toBe(2000)
  })
})

describe('Pep.intercept —— 决策缓存', () => {
  it('缓存命中（同 key、新 request_id 不入 key）→ 不质询直接执行', async () => {
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const pep = new Pep({ pdp })
    await pep.intercept(q())
    const out = await pep.intercept(q({ request_id: 'req-2' }))
    expect(pdp.callCount).toBe(1)
    expect(out.outcome).toBe('execute')
    expect(out.decision.audit_token).toBe('aud-allow-1')
  })

  it('缓存 ttl 到期 → 重新质询并刷新缓存', async () => {
    let now = 1_000_000
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const pep = new Pep({ pdp, clock: () => now })
    await pep.intercept(q())
    now += 299_999
    await pep.intercept(q({ request_id: 'req-2' }))
    expect(pdp.callCount).toBe(1)
    now += 1
    await pep.intercept(q({ request_id: 'req-3' }))
    expect(pdp.callCount).toBe(2)
  })

  it('policy_version 变化 → 缓存全量失效，重新质询', async () => {
    const pdp = new MockPdp({
      decisions: [allowDecision, { ...allowDecision, audit_token: 'aud-allow-2' }]
    })
    const pep = new Pep({ pdp })
    await pep.intercept(q())
    const out = await pep.intercept(q({ policy_version: 'omnigent-policy-v2', request_id: 'req-2' }))
    expect(pdp.callCount).toBe(2)
    expect(out.decision.audit_token).toBe('aud-allow-2')
  })

  it('deny 决策同样缓存（ttl 内不重复质询）', async () => {
    const pdp = new MockPdp({ decisions: [denyDecision] })
    const pep = new Pep({ pdp })
    const first = await pep.intercept(q())
    const second = await pep.intercept(q({ request_id: 'req-2' }))
    expect(first.outcome).toBe('reject')
    expect(second.outcome).toBe('reject')
    expect(pdp.callCount).toBe(1)
    expect(second.decision.audit_token).toBe('aud-deny-1')
  })

  it('ttl_seconds=0 的决策不缓存', async () => {
    const pdp = new MockPdp({
      decisions: [{ decision: 'deny', reason_code: 'R0', ttl_seconds: 0, audit_token: 'aud-0' }]
    })
    const pep = new Pep({ pdp })
    await pep.intercept(q())
    await pep.intercept(q({ request_id: 'req-2' }))
    expect(pdp.callCount).toBe(2)
  })
})

describe('Pep.intercept —— fail-closed（对超时/网络错/畸形响应闭合）', () => {
  it('PDP 超时 → deny + 审计标记 fail_closed（reason=PDP_TIMEOUT）', async () => {
    const pdp = new MockPdp({ decisions: [allowDecision], delayMs: 100 })
    const { audits, sink } = auditCollector()
    const pep = new Pep({ pdp, timeoutMs: 20, auditSink: sink })
    const out = await pep.intercept(q({ request_id: 'req-t' }))
    expect(out.outcome).toBe('reject')
    expect(out.decision.decision).toBe('deny')
    expect(out.decision.reason_code).toBe('PDP_TIMEOUT')
    expect(audits).toEqual([
      {
        agent: 'nexus-dev-01',
        session_id: 'sess-1',
        tool_call: 'req-t',
        decision: 'fail_closed',
        token: expect.stringMatching(/^aud-/)
      } satisfies AuditEvent
    ])
  })

  it('PDP 超时后迟到报错 → 仍 fail-closed 且无未处理拒绝', async () => {
    const pdp = new MockPdp({ failWith: new Error('socket hang up'), delayMs: 50 })
    const pep = new Pep({ pdp, timeoutMs: 20 })
    const out = await pep.intercept(q())
    expect(out.decision.reason_code).toBe('PDP_TIMEOUT')
    await new Promise(resolve => setTimeout(resolve, 80))
  })

  it.each([
    [
      '非法枚举',
      { decision: 'maybe', reason_code: 'R', ttl_seconds: 5, audit_token: 'aud-x' }
    ],
    ['缺 audit_token', { decision: 'allow', reason_code: 'R', ttl_seconds: 5 }]
  ])('PDP 畸形响应（%s）→ deny（reason=PDP_MALFORMED）+ fail_closed', async (_label, malformed) => {
    const pdp = new MockPdp({ malformed })
    const { audits, sink } = auditCollector()
    const pep = new Pep({ pdp, auditSink: sink })
    const out = await pep.intercept(q({ request_id: 'req-m' }))
    expect(out.outcome).toBe('reject')
    expect(out.decision.reason_code).toBe('PDP_MALFORMED')
    expect(audits[0]?.decision).toBe('fail_closed')
    expect(audits[0]?.tool_call).toBe('req-m')
  })

  it('PDP 网络错误 → deny（reason=PDP_UNREACHABLE）+ fail_closed', async () => {
    const pdp = new MockPdp({ failWith: new Error('ECONNREFUSED') })
    const { audits, sink } = auditCollector()
    const pep = new Pep({ pdp, auditSink: sink })
    const out = await pep.intercept(q({ request_id: 'req-n' }))
    expect(out.outcome).toBe('reject')
    expect(out.decision.reason_code).toBe('PDP_UNREACHABLE')
    expect(audits[0]?.decision).toBe('fail_closed')
  })
})

describe('Pep.intercept —— pause 人审语义', () => {
  it('pause → 返回挂起，audit_token 三点贯穿（query→decision→audit）', async () => {
    const pdp = new MockPdp({ decisions: [pauseDecision] })
    const { audits, sink } = auditCollector()
    const pep = new Pep({ pdp, auditSink: sink })
    const out = await pep.intercept(q({ request_id: 'req-pause-1' }))
    expect(out.outcome).toBe('pause')
    expect(out.decision).toEqual(pauseDecision)
    expect(pdp.calls[0]?.request_id).toBe('req-pause-1')
    expect(audits).toEqual([
      {
        agent: 'nexus-dev-01',
        session_id: 'sess-1',
        tool_call: 'req-pause-1',
        decision: 'pause',
        token: 'aud-pause-1'
      }
    ])
  })

  it('pause 不缓存（每次重新质询）', async () => {
    const pdp = new MockPdp({ decisions: [pauseDecision] })
    const pep = new Pep({ pdp })
    await pep.intercept(q({ request_id: 'req-r1' }))
    await pep.intercept(q({ request_id: 'req-r2' }))
    expect(pdp.callCount).toBe(2)
  })
})

describe('Pep.intercept —— 静态规则（本地只匹配、不判断，ADR-01 边界）', () => {
  it.each([
    [
      'cmd_class=read',
      q({
        action: { type: 'tool_call', tool: 'cat', args_meta: { cmd_class: 'read' } },
        request_id: 'req-read-1'
      })
    ],
    [
      'nexus.memory.recall',
      q({
        action: { type: 'tool_call', tool: 'nexus.memory.recall', args_meta: {} },
        resource: { type: 'memory' },
        request_id: 'req-read-2'
      })
    ]
  ])('非敏感操作（%s）→ 白名单直通，不发起网络质询', async (_label, query) => {
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const { audits, sink } = auditCollector()
    const pep = new Pep({ pdp, auditSink: sink })
    const out = await pep.intercept(query)
    expect(pdp.callCount).toBe(0)
    expect(out.outcome).toBe('execute')
    expect(out.decision.reason_code).toMatch(/^STATIC_/)
    expect(out.decision.decision).toBe('allow')
    expect(audits[0]).toMatchObject({ decision: 'allow', tool_call: query.request_id })
  })

  it('静态规则命中且缓存未过期 → 二次调用同样不质询', async () => {
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const pep = new Pep({ pdp, staticTtlSeconds: 60 })
    const readQuery = q({
      action: { type: 'tool_call', tool: 'cat', args_meta: { cmd_class: 'read' } }
    })
    await pep.intercept(readQuery)
    await pep.intercept(q({ ...readQuery, request_id: 'req-2' }))
    expect(pdp.callCount).toBe(0)
  })

  it('credential 资源 → 静态 deny，不质询', async () => {
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const { audits, sink } = auditCollector()
    const pep = new Pep({ pdp, auditSink: sink })
    const out = await pep.intercept(
      q({ resource: { type: 'credential', path: 'vault/aws-main' }, request_id: 'req-c' })
    )
    expect(pdp.callCount).toBe(0)
    expect(out.outcome).toBe('reject')
    expect(out.decision.reason_code).toBe('STATIC_credential-deny')
    expect(audits[0]).toMatchObject({ decision: 'deny', tool_call: 'req-c' })
  })

  it('自定义 staticRules 完全替换默认集（黑名单外仍需质询）', async () => {
    const rules: StaticRule[] = [{ id: 'blk-secrets', effect: 'deny', pathPrefix: '/repo/secrets' }]
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const pep = new Pep({ pdp, staticRules: rules })
    const blocked = await pep.intercept(q({ resource: { type: 'file', path: '/repo/secrets/env.sh' } }))
    expect(blocked.outcome).toBe('reject')
    expect(blocked.decision.reason_code).toBe('STATIC_blk-secrets')
    const allowed = await pep.intercept(
      q({ resource: { type: 'file', path: '/repo/src/main.go' }, request_id: 'req-ok' })
    )
    expect(allowed.outcome).toBe('execute')
    expect(pdp.callCount).toBe(1)
  })

  it('审计事件五元组完整（默认 baseQuery 的 agent/session 透传）', async () => {
    const pdp = new MockPdp({ decisions: [allowDecision] })
    const { audits, sink } = auditCollector()
    const pep = new Pep({ pdp, auditSink: sink })
    await pep.intercept(q())
    expect(audits).toEqual([
      {
        agent: baseQuery.subject.name,
        session_id: baseQuery.subject.session_id,
        tool_call: baseQuery.request_id,
        decision: 'allow',
        token: 'aud-allow-1'
      } satisfies AuditEvent
    ])
  })
})
