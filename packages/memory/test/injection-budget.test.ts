import { describe, it, expect } from 'vitest'
import { InjectionBudget } from '../src/injection-budget.js'

describe('InjectionBudget', () => {
  it('默认上限 2000 tokens', () => {
    const b = new InjectionBudget()
    expect(b.remaining).toBe(2000)
  })

  it('消耗后剩余正确扣减', () => {
    const b = new InjectionBudget()
    b.consume(500)
    expect(b.remaining).toBe(1500)
  })

  it('超额时拒绝并返回 false', () => {
    const b = new InjectionBudget()
    expect(b.consume(1500)).toBe(true)
    expect(b.consume(600)).toBe(false)
    expect(b.remaining).toBe(500)
  })

  it('canFit 返回剩余是否足够', () => {
    const b = new InjectionBudget()
    expect(b.canFit(2000)).toBe(true)
    expect(b.canFit(2001)).toBe(false)
    b.consume(1900)
    expect(b.canFit(100)).toBe(true)
    expect(b.canFit(101)).toBe(false)
  })

  it('selectIncluded 按分数降序贪心装入，返回实际包含的索引', () => {
    const b = new InjectionBudget()
    const hits = [
      { text: 'short', tokens: 100, score: 0.9 },
      { text: 'medium', tokens: 800, score: 0.8 },
      { text: 'long', tokens: 1200, score: 0.7 }
    ]
    const included = b.selectIncluded(hits)
    expect(included).toEqual([0, 1])
    expect(b.remaining).toBe(1100)
  })

  it('selectIncluded 全部装不下的极端情况', () => {
    const b = new InjectionBudget()
    const hits = [{ text: 'huge', tokens: 5000, score: 1.0 }]
    const included = b.selectIncluded(hits)
    expect(included).toEqual([])
    expect(b.remaining).toBe(2000)
  })

  it('零 token hit 不消耗预算', () => {
    const b = new InjectionBudget()
    const hits = [{ text: '', tokens: 0, score: 0.5 }]
    const included = b.selectIncluded(hits)
    expect(included).toEqual([0])
    expect(b.remaining).toBe(2000)
  })

  it('reset 恢复全部预算', () => {
    const b = new InjectionBudget()
    b.consume(1000)
    b.reset()
    expect(b.remaining).toBe(2000)
  })

  it('自定义上限', () => {
    const b = new InjectionBudget({ maxTokens: 500 })
    expect(b.remaining).toBe(500)
    b.consume(500)
    expect(b.canFit(1)).toBe(false)
  })

  it('fractionUsed 返回已用比例', () => {
    const b = new InjectionBudget()
    expect(b.fractionUsed).toBe(0)
    b.consume(500)
    expect(b.fractionUsed).toBeCloseTo(0.25)
    b.consume(1500)
    expect(b.fractionUsed).toBe(1.0)
  })
})
