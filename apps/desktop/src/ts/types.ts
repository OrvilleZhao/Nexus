export interface Session {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AuditEntry {
  ts: string;
  perspective: string;
  query: string;
  decision: string;
  reason: string;
}

export type TerminalTab = 'output' | 'audit';
