import type { PolicyQuery } from '@nexus/core'

export interface StaticRule {
  id: string
  effect: 'allow' | 'deny'
  tool?: string
  cmdClass?: string
  resourceType?: PolicyQuery['resource']['type']
  pathPrefix?: string
}

export const DEFAULT_STATIC_RULES: readonly StaticRule[] = [
  { id: 'read-allowlist', effect: 'allow', cmdClass: 'read' },
  { id: 'memory-recall-allow', effect: 'allow', tool: 'nexus.memory.recall' },
  { id: 'credential-deny', effect: 'deny', resourceType: 'credential' }
]

export function matchesRule(rule: StaticRule, query: PolicyQuery): boolean {
  if (rule.tool !== undefined && rule.tool !== query.action.tool) return false
  if (rule.cmdClass !== undefined && rule.cmdClass !== query.action.args_meta.cmd_class) return false
  if (rule.resourceType !== undefined && rule.resourceType !== query.resource.type) return false
  if (rule.pathPrefix !== undefined) {
    if (query.resource.path === undefined) return false
    if (!query.resource.path.startsWith(rule.pathPrefix)) return false
  }
  return true
}

export class StaticRuleSet {
  private readonly rules: readonly StaticRule[]

  constructor(rules: readonly StaticRule[]) {
    this.rules = rules
  }

  firstMatch(query: PolicyQuery): StaticRule | undefined {
    return this.rules.find(rule => matchesRule(rule, query))
  }
}
