import type { Pep } from '@nexus/bridge'
import type { FunesClient, TrajectorySync, InjectionBudget } from '@nexus/memory'
import { makePolicyQuery } from '@nexus/core'

export interface NexusPluginOptions {
  pep?: Pep
  funes?: FunesClient
  trajectorySync?: TrajectorySync
  injectionBudget?: InjectionBudget
  auditSink?: (event: unknown) => void
}

export interface PluginModule {
  name: string
  inject: string[]
  apply: (ctx: unknown) => void
}

export function createNexusPlugin(_opts: NexusPluginOptions): PluginModule {
  return {
    name: 'nexus-memory',
    inject: ['tools'],
    apply(ctx: unknown) {
      const c = ctx as { tools: { register(tool: unknown): void } }
      for (const def of createMemoryToolDefs()) {
        c.tools.register(def)
      }
    }
  }
}

function createMemoryToolDefs() {
  return [
    {
      name: 'nexus.memory.recall',
      description: 'Recall relevant memories from past sessions.',
      parameters: { query: { type: 'string', required: true, description: 'Search query' } },
      output: { schema: { type: 'array' } }
    },
    {
      name: 'nexus.memory.save',
      description: 'Save a decision or finding to memory.',
      parameters: {
        content: { type: 'string', required: true, description: 'Content to save' },
        agent: { type: 'string', required: true, description: 'Agent name' },
        session_id: { type: 'string', required: true, description: 'Session ID' }
      },
      output: { schema: { type: 'object' } }
    }
  ]
}

export async function withPepIntercept<T>(
  pep: Pep,
  agent: string,
  sessionId: string,
  cb: () => Promise<T>,
  denyFallback: string = 'Policy denied'
): Promise<T | string> {
  const query = makePolicyQuery({ agent, sessionId, tool: 'nexus.memory', resourceType: 'memory' })
  const outcome = await pep.intercept(query)
  if (outcome.outcome === 'execute') return cb()
  return `${denyFallback}: ${outcome.decision.reason_code}`
}
