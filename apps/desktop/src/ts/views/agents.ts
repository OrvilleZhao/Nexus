import type { AgentConfig, AgentStore } from '../agents.js'
import type { ProviderStore } from '../providers.js'
import { uid, esc } from '../util.js'
import { terminal } from '../terminal.js'

export class AgentsView {
  private selectedId: string | null = null

  constructor(
    private readonly agents: AgentStore,
    private readonly providers: ProviderStore,
  ) {}

  render(): void {
    const root = document.getElementById('view-agents')
    if (!root) return
    const list = this.agents.list()
    const selected = (this.selectedId ? this.agents.get(this.selectedId) : undefined) ?? list[0]
    this.selectedId = selected?.id ?? null
    root.innerHTML = `
      <div class="manage-layout">
        <div class="manage-list">
          <div class="manage-list-header"><span>Agents</span><button class="btn btn-small" id="agent-new">+ New</button></div>
          ${list.map(a => `
            <div class="manage-item${a.id === this.selectedId ? ' active' : ''}" data-id="${a.id}">
              <div class="manage-item-title">${esc(a.name)}</div>
              <div class="manage-item-meta">${esc(this.providers.get(a.providerId)?.name ?? 'no provider')}</div>
            </div>`).join('')}
        </div>
        <div class="manage-editor">${selected ? this.editorHtml(selected) : '<div class="empty-hint">Create an agent to start chatting.</div>'}</div>
      </div>`
    this.bind()
  }

  private editorHtml(a: AgentConfig): string {
    const providers = this.providers.list()
    return `
      <div class="form">
        <div class="field"><label>Name</label><input id="af-name" value="${esc(a.name)}" /></div>
        <div class="field"><label>System prompt</label><textarea id="af-prompt" rows="6">${esc(a.systemPrompt)}</textarea></div>
        <div class="field"><label>Provider</label>
          <select id="af-provider">
            <option value="">— none —</option>
            ${providers.map(p => `<option value="${p.id}"${p.id === a.providerId ? ' selected' : ''}>${esc(p.name)} (${esc(p.model || 'no model')})</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Model override</label><input id="af-model" value="${esc(a.model)}" placeholder="empty = provider default" /></div>
        <div class="form-actions">
          <button class="btn" id="af-save">Save</button>
          <button class="btn btn-danger" id="af-delete">Delete</button>
        </div>
      </div>`
  }

  private bind(): void {
    const root = document.getElementById('view-agents')!
    root.querySelectorAll('.manage-item').forEach(el =>
      el.addEventListener('click', () => {
        this.selectedId = (el as HTMLElement).dataset.id ?? null
        this.render()
      }),
    )
    root.querySelector('#agent-new')?.addEventListener('click', () => {
      const agent: AgentConfig = {
        id: uid(),
        name: 'New Agent',
        systemPrompt: '',
        providerId: this.providers.default()?.id ?? '',
        model: '',
      }
      this.agents.upsert(agent)
      this.selectedId = agent.id
      terminal.log('info', `agent created: ${agent.name}`)
      this.render()
    })
    root.querySelector('#af-save')?.addEventListener('click', () => {
      const existing = this.selectedId ? this.agents.get(this.selectedId) : undefined
      if (!existing) return
      const nameInput = root.querySelector('#af-name') as HTMLInputElement
      const promptInput = root.querySelector('#af-prompt') as HTMLTextAreaElement
      const providerSelect = root.querySelector('#af-provider') as HTMLSelectElement
      const modelInput = root.querySelector('#af-model') as HTMLInputElement
      this.agents.upsert({
        ...existing,
        name: nameInput.value.trim() || existing.name,
        systemPrompt: promptInput.value,
        providerId: providerSelect.value,
        model: modelInput.value.trim(),
      })
      terminal.log('info', `agent saved: ${nameInput.value.trim() || existing.name}`)
      this.render()
    })
    root.querySelector('#af-delete')?.addEventListener('click', () => {
      if (!this.selectedId) return
      this.agents.remove(this.selectedId)
      this.selectedId = null
      this.render()
    })
  }
}
