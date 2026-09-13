export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isError?: boolean
}

export interface Session {
  id: string
  title: string
  createdAt: number
  agentId?: string
  messages: Message[]
}

export type TerminalTab = 'output' | 'audit'
