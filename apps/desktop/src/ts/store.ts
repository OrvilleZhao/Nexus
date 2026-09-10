import type { Session } from './types';

const SESSIONS_KEY = 'nexus.sessions';

export const store = {
  sessions: [] as Session[],

  load() {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) this.sessions = JSON.parse(raw);
    } catch { this.sessions = []; }
  },

  save() {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(this.sessions));
  },

  create(): Session {
    const s: Session = {
      id: crypto.randomUUID(),
      title: 'New Session',
      createdAt: Date.now(),
      messages: [],
    };
    this.sessions.unshift(s);
    this.save();
    return s;
  },

  get(id: string): Session | undefined {
    return this.sessions.find(s => s.id === id);
  },

  current: null as Session | null,

  delete(id: string) {
    this.sessions = this.sessions.filter(s => s.id !== id);
    if (this.current?.id === id) this.current = null;
    this.save();
  },
};
