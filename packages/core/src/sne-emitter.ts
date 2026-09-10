import type { SneEnvelope, SnePayload } from './sne.js'

export type SneEventKind = SnePayload['kind']

export type SneListener = (event: SneEnvelope) => void

export class SneeEmitter {
  private readonly listeners = new Map<string, SneListener[]>()

  on(kind: SneEventKind | '*', listener: SneListener): void {
    const list = this.listeners.get(kind) ?? []
    list.push(listener)
    this.listeners.set(kind, list)
  }

  off(kind: SneEventKind | '*', listener: SneListener): void {
    const list = this.listeners.get(kind)
    if (list === undefined) return
    const idx = list.indexOf(listener)
    if (idx !== -1) list.splice(idx, 1)
  }

  emit(event: SneEnvelope): void {
    const kindListeners = this.listeners.get(event.payload.kind) ?? []
    for (const fn of kindListeners) fn(event)
    const starListeners = this.listeners.get('*') ?? []
    for (const fn of starListeners) fn(event)
  }

  listenerCount(kind: SneEventKind | '*'): number {
    return (this.listeners.get(kind) ?? []).length
  }
}
