import { invoke } from '@tauri-apps/api/core'
import type { ProviderConfig } from './providers.js'

export interface ChatMessagePayload {
  role: string
  content: string
}

export async function chatCompletion(
  provider: ProviderConfig,
  modelOverride: string,
  messages: ChatMessagePayload[],
): Promise<string> {
  const model = modelOverride.trim() || provider.model
  return invoke<string>('chat_completion', {
    request: {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model,
      apiType: provider.apiType,
      messages,
    },
  })
}

export async function testProvider(provider: ProviderConfig): Promise<string> {
  const model = provider.model.trim() || 'default'
  return invoke<string>('test_provider', {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model,
    apiType: provider.apiType,
  })
}
