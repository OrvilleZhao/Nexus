import { uid, type KVStorage } from './util.js'

export interface AgentConfig {
  id: string
  name: string
  systemPrompt: string
  providerId: string
  model: string
}

const AGENTS_KEY = 'nexus.agents'

export class AgentStore {
  constructor(private readonly storage: KVStorage) {}

  private load(): AgentConfig[] {
    try {
      const raw = this.storage.getItem(AGENTS_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed as AgentConfig[]
    } catch {
      return []
    }
  }

  private save(list: AgentConfig[]): void {
    this.storage.setItem(AGENTS_KEY, JSON.stringify(list))
  }

  seed(defaultProviderId: string): void {
    if (this.load().length > 0) return
    const agent: AgentConfig = {
      id: uid(),
      name: 'General Assistant',
      systemPrompt: 'You are a helpful assistant.',
      providerId: defaultProviderId,
      model: '',
    }
    this.save([agent])
  }

  list(): AgentConfig[] {
    return this.load()
  }

  get(id: string): AgentConfig | undefined {
    return this.load().find(a => a.id === id)
  }

  upsert(agent: AgentConfig): void {
    const list = this.load()
    const idx = list.findIndex(a => a.id === agent.id)
    if (idx >= 0) list[idx] = agent
    else list.push(agent)
    this.save(list)
  }

  remove(id: string): void {
    this.save(this.load().filter(a => a.id !== id))
  }
}
