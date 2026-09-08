import { describe, expect, it } from 'vitest'
import { DEFAULT_STATIC_RULES, matchesRule, StaticRuleSet } from '../src/index.js'
import { q } from './fixtures.js'

describe('matchesRule', () => {
  it('空条件规则匹配一切（显式全局规则语义）', () => {
    expect(matchesRule({ id: 'x', effect: 'deny' }, q())).toBe(true)
  })

  it('tool 精确匹配', () => {
    expect(matchesRule({ id: 'x', effect: 'allow', tool: 'shell' }, q())).toBe(true)
    expect(matchesRule({ id: 'x', effect: 'allow', tool: 'edit' }, q())).toBe(false)
  })

  it('cmdClass 匹配 args_meta.cmd_class', () => {
    expect(matchesRule({ id: 'x', effect: 'allow', cmdClass: 'file_write' }, q())).toBe(true)
    expect(matchesRule({ id: 'x', effect: 'allow', cmdClass: 'read' }, q())).toBe(false)
  })

  it('resourceType 匹配', () => {
    expect(matchesRule({ id: 'x', effect: 'deny', resourceType: 'file' }, q())).toBe(true)
    expect(matchesRule({ id: 'x', effect: 'deny', resourceType: 'credential' }, q())).toBe(false)
  })

  it('pathPrefix 前缀匹配；path 缺失不匹配', () => {
    expect(matchesRule({ id: 'x', effect: 'deny', pathPrefix: '/repo' }, q())).toBe(true)
    expect(matchesRule({ id: 'x', effect: 'deny', pathPrefix: '/etc' }, q())).toBe(false)
    expect(matchesRule({ id: 'x', effect: 'deny', pathPrefix: '/repo' }, q({ resource: { type: 'file' } }))).toBe(false)
  })

  it('多条件 AND 语义（任一不满足即不命中）', () => {
    expect(matchesRule({ id: 'x', effect: 'deny', tool: 'shell', pathPrefix: '/repo' }, q())).toBe(true)
    expect(matchesRule({ id: 'x', effect: 'deny', tool: 'shell', pathPrefix: '/etc' }, q())).toBe(false)
  })
})

describe('StaticRuleSet.firstMatch', () => {
  it('按声明顺序取首个命中', () => {
    const set = new StaticRuleSet([
      { id: 'first', effect: 'deny', tool: 'shell' },
      { id: 'second', effect: 'allow', tool: 'shell' }
    ])
    expect(set.firstMatch(q())?.id).toBe('first')
  })

  it('无命中返回 undefined', () => {
    const set = new StaticRuleSet([{ id: 'x', effect: 'deny', tool: 'edit' }])
    expect(set.firstMatch(q())).toBeUndefined()
  })

  it('默认规则集：credential 拒绝、read 放行、其余不命中', () => {
    const set = new StaticRuleSet(DEFAULT_STATIC_RULES)
    expect(set.firstMatch(q({ resource: { type: 'credential' } }))?.id).toBe('credential-deny')
    expect(
      set.firstMatch(q({ action: { type: 'tool_call', tool: 'cat', args_meta: { cmd_class: 'read' } } }))?.id
    ).toBe('read-allowlist')
    expect(set.firstMatch(q())).toBeUndefined()
  })
})
