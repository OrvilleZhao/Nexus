import { uid, type KVStorage } from './util.js'

export type ApiType = 'openai' | 'anthropic'

export interface ProviderConfig {
  id: string
  name: string
  apiType: ApiType
  baseUrl: string
  apiKey: string
  model: string
  isDefault: boolean
}

export interface ProviderPreset {
  name: string
  apiType: ApiType
  baseUrl: string
  model: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: 'DeepSeek', apiType: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenAI', apiType: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'Anthropic', apiType: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  { name: 'Custom (OpenAI-compatible)', apiType: 'openai', baseUrl: '', model: '' },
]

const PROVIDERS_KEY = 'nexus.providers'

export class ProviderStore {
  constructor(private readonly storage: KVStorage) {}

  private load(): ProviderConfig[] {
    try {
      const raw = this.storage.getItem(PROVIDERS_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed as ProviderConfig[]
    } catch {
      return []
    }
  }

  private save(list: ProviderConfig[]): void {
    this.storage.setItem(PROVIDERS_KEY, JSON.stringify(list))
  }

  seed(): void {
    if (this.load().length > 0) return
    const list = PROVIDER_PRESETS.slice(0, 3).map((p, i) => ({
      id: uid(),
      name: p.name,
      apiType: p.apiType,
      baseUrl: p.baseUrl,
      apiKey: '',
      model: p.model,
      isDefault: i === 0,
    }))
    this.save(list)
  }

  list(): ProviderConfig[] {
    return this.load()
  }

  get(id: string): ProviderConfig | undefined {
    return this.load().find(p => p.id === id)
  }

  default(): ProviderConfig | undefined {
    const list = this.load()
    return list.find(p => p.isDefault) ?? list[0]
  }

  upsert(p: ProviderConfig): void {
    const list = this.load()
    const idx = list.findIndex(x => x.id === p.id)
    if (idx >= 0) list[idx] = p
    else list.push(p)
    if (p.isDefault) {
      for (const x of list) {
        if (x.id !== p.id) x.isDefault = false
      }
    }
    if (list.length > 0 && !list.some(x => x.isDefault)) list[0]!.isDefault = true
    this.save(list)
  }

  remove(id: string): void {
    const list = this.load().filter(x => x.id !== id)
    if (list.length > 0 && !list.some(x => x.isDefault)) list[0]!.isDefault = true
    this.save(list)
  }

  setDefault(id: string): void {
    const list = this.load()
    for (const x of list) x.isDefault = x.id === id
    this.save(list)
  }

  createFromPreset(presetIndex: number): ProviderConfig {
    const preset = PROVIDER_PRESETS[presetIndex] ?? PROVIDER_PRESETS[3]!
    const p: ProviderConfig = {
      id: uid(),
      name: preset.name,
      apiType: preset.apiType,
      baseUrl: preset.baseUrl,
      apiKey: '',
      model: preset.model,
      isDefault: false,
    }
    this.upsert(p)
    return p
  }
}
