import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  assertExportable,
  makeMemoryRecord,
  RedactionError,
  SchemaError,
  type MemoryRecord
} from '../src/index.js'

const base = {
  agent: 'dsh',
  session_id: 'sess-1',
  turn_id: 'turn-1',
  project: 'nexus'
} as const

describe('makeMemoryRecord', () => {
  it('自动计算 hash = sha256(脱敏后 content)', () => {
    const content = '决定采用 pnpm workspaces 管理仓库结构'
    const record = makeMemoryRecord({ ...base, content })
    const expected = createHash('sha256').update(content, 'utf8').digest('hex')
    expect(record.hash).toBe(expected)
    expect(record.hash).toHaveLength(64)
  })

  it('hash 基于脱敏后内容计算（防哈希侧信道泄漏）', () => {
    const record = makeMemoryRecord({ ...base, content: 'staging key AKIAIOSFODNN7EXAMPLE leaked' })
    const expected = createHash('sha256').update(record.content, 'utf8').digest('hex')
    expect(record.hash).toBe(expected)
  })

  it('默认时间戳为当前时间；显式 ts 优先', () => {
    const before = Date.now()
    const defaulted = makeMemoryRecord({ ...base, content: 'x' })
    const after = Date.now()
    expect(defaulted.ts).toBeGreaterThanOrEqual(before)
    expect(defaulted.ts).toBeLessThanOrEqual(after)
    expect(makeMemoryRecord({ ...base, content: 'x', ts: 1000 }).ts).toBe(1000)
  })

  it('完整字段输入（file/line/tags）保留', () => {
    const record = makeMemoryRecord({
      ...base,
      content: 'x',
      file: 'src/a.ts',
      line: 42,
      tags: ['retry-strategy']
    })
    expect(record.file).toBe('src/a.ts')
    expect(record.line).toBe(42)
    expect(record.tags).toEqual(['retry-strategy'])
  })

  it.each([
    ['aws-access-key', 'staging key is AKIAIOSFODNN7EXAMPLE do not leak', /AKIAIOSFODNN7EXAMPLE/],
    ['secret-key', 'token: sk-abcdefghijklmnopqrstuvwx', /sk-abcdefghijklmnopqrstuvwx/],
    [
      'bearer-token',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload',
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/
    ],
    ['password-assignment', 'db connection: password=hunter2 timeout=5', /hunter2/],
    ['internal-ip', 'service lives at 10.1.2.3:8080 internally', /10\.1\.2\.3/],
    ['internal-domain', 'see https://git.internal.acme.cn/repo for details', /git\.internal\.acme\.cn/]
  ])('敏感模式 %s 被替换且记录规则 id', (rule, content, leaked) => {
    const record = makeMemoryRecord({ ...base, content })
    expect(record.content).not.toMatch(leaked)
    expect(record.redaction_applied).toContain(rule)
    expect(record.redacted).toBe(true)
  })

  it('干净内容保持原样且 applied 为空（redacted 语义 = 已过管线）', () => {
    const content = '纯决策文本：采用单向同步，禁止双写'
    const record = makeMemoryRecord({ ...base, content })
    expect(record.content).toBe(content)
    expect(record.redaction_applied).toEqual([])
    expect(record.redacted).toBe(true)
  })

  it('空 agent → SchemaError', () => {
    expect(() => makeMemoryRecord({ ...base, agent: '', content: 'x' })).toThrowError(SchemaError)
  })
})

describe('assertExportable（写侧前置拦截）', () => {
  it('未过脱敏管线的 record（redacted=false）抛 RedactionError 并携带定位信息', () => {
    const raw: MemoryRecord = { ...makeMemoryRecord({ ...base, content: 'x' }), redacted: false }
    expect(() => assertExportable(raw)).toThrowError(RedactionError)
    expect(() => assertExportable(raw)).toThrowError(/sess-1\/turn-1/)
  })

  it('已过管线（redacted=true）放行', () => {
    const record = makeMemoryRecord({ ...base, content: 'x' })
    expect(() => assertExportable(record)).not.toThrow()
  })
})
