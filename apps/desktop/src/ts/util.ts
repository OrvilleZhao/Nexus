export interface KVStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function memoryStorage(): KVStorage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v) },
    removeItem: (k) => { m.delete(k) },
  }
}

export function browserStorage(): KVStorage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
    return memoryStorage()
  } catch {
    return memoryStorage()
  }
}

export function uid(): string {
  return crypto.randomUUID()
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
