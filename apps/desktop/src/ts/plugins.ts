import type { KVStorage } from './util.js'

export interface PluginDef {
  id: string
  name: string
  description: string
  requiresBackend: boolean
  defaultEnabled: boolean
}

export const BUILTIN_PLUGINS: PluginDef[] = [
  { id: 'nexus.audit.log', name: 'Audit Logging', description: 'Log every model call to the Audit tab', requiresBackend: false, defaultEnabled: true },
  { id: 'nexus.terminal.verbose', name: 'Verbose Output', description: 'Log request/response details to the Output tab', requiresBackend: false, defaultEnabled: false },
  { id: 'nexus.memory.recall', name: 'Memory Recall', description: 'Inject cross-session memories via Funes', requiresBackend: true, defaultEnabled: true },
  { id: 'nexus.memory.save', name: 'Memory Save', description: 'Persist trajectory turns via Funes', requiresBackend: true, defaultEnabled: true },
]

const PLUGINS_KEY = 'nexus.plugins'

export class PluginStore {
  constructor(private readonly storage: KVStorage) {}

  private load(): Record<string, boolean> {
    try {
      const raw = this.storage.getItem(PLUGINS_KEY)
      if (!raw) return {}
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
      return parsed as Record<string, boolean>
    } catch {
      return {}
    }
  }

  private save(state: Record<string, boolean>): void {
    this.storage.setItem(PLUGINS_KEY, JSON.stringify(state))
  }

  defs(): PluginDef[] {
    return BUILTIN_PLUGINS
  }

  isLocked(id: string): boolean {
    return BUILTIN_PLUGINS.find(p => p.id === id)?.requiresBackend ?? false
  }

  isEnabled(id: string): boolean {
    const state = this.load()
    if (id in state) return state[id] === true
    return BUILTIN_PLUGINS.find(p => p.id === id)?.defaultEnabled ?? false
  }

  setEnabled(id: string, on: boolean): void {
    if (this.isLocked(id)) return
    const state = this.load()
    state[id] = on
    this.save(state)
  }

  toggle(id: string): boolean {
    const next = !this.isEnabled(id)
    this.setEnabled(id, next)
    return this.isEnabled(id)
  }
}
