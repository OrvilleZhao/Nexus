import { describe, expect, it } from 'vitest'
import { makeCacheKey, parsePolicyDecision, parsePolicyQuery } from '@nexus/core'
import { DecisionCache } from '../src/index.js'
import { baseQuery } from './fixtures.js'

const query = parsePolicyQuery(baseQuery)
const key = makeCacheKey(query)
const decision = parsePolicyDecision({
  decision: 'allow',
  reason_code: 'R',
  ttl_seconds: 60,
  audit_token: 'aud-1'
})

describe('DecisionCache', () => {
  it('set/get 往返', () => {
    const cache = new DecisionCache()
    cache.set(key, decision)
    expect(cache.get(key)).toEqual(decision)
    expect(cache.size).toBe(1)
  })

  it('ttl_seconds=0 或 pause 决策不入缓存', () => {
    const cache = new DecisionCache()
    cache.set(key, { ...decision, ttl_seconds: 0 })
    expect(cache.size).toBe(0)
    cache.set(key, { ...decision, decision: 'pause' })
    expect(cache.size).toBe(0)
  })

  it('ttl 到期失效（时钟注入）', () => {
    let now = 0
    const cache = new DecisionCache({ clock: () => now })
    cache.set(key, decision)
    now = 59_999
    expect(cache.get(key)).toBeDefined()
    now = 60_000
    expect(cache.get(key)).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('不同 key 互不影响（policy_version 维度）', () => {
    const cache = new DecisionCache()
    cache.set(key, decision)
    const keyV2 = makeCacheKey(parsePolicyQuery({ ...baseQuery, policy_version: 'v2' }))
    expect(cache.get(keyV2)).toBeUndefined()
  })

  it('clear 清空全部', () => {
    const cache = new DecisionCache()
    cache.set(key, decision)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get(key)).toBeUndefined()
  })
})
