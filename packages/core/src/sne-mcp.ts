import type { SneEnvelope } from './sne.js'

export interface McpNotification {
  jsonrpc: '2.0'
  method: string
  params: Record<string, unknown>
}

export function sneToMcpNotification(env: SneEnvelope): McpNotification {
  return {
    jsonrpc: '2.0',
    method: 'notifications/sne/event',
    params: {
      kind: env.payload.kind,
      sne_id: env.id,
      ts: env.ts,
      agent: env.agent,
      payload: env.payload
    }
  }
}

export function mcpNotificationToSne(notif: McpNotification): SneEnvelope {
  const params = notif.params as {
    kind: string
    sne_id: string
    ts: number
    agent: { name: string; session_id: string }
    payload: SneEnvelope['payload']
  }
  return {
    id: params.sne_id,
    ts: params.ts,
    schema: 'sne/1',
    agent: params.agent,
    payload: params.payload
  }
}
