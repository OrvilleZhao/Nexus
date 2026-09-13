import { PROVIDER_PRESETS, type ApiType, type ProviderConfig, type ProviderStore } from '../providers.js'
import { testProvider } from '../api.js'
import { uid, esc } from '../util.js'
import { terminal } from '../terminal.js'

export class SettingsView {
  private selectedId: string | null = null

  constructor(private readonly providers: ProviderStore) {}

  render(): void {
    const root = document.getElementById('view-settings')
    if (!root) return
    const list = this.providers.list()
    const selected = (this.selectedId ? this.providers.get(this.selectedId) : undefined) ?? list[0]
    this.selectedId = selected?.id ?? null
    root.innerHTML = `
      <div class="manage-layout">
        <div class="manage-list">
          <div class="manage-list-header">
            <span>Providers</span>
            <select id="provider-preset-add">
              <option value="">+ Add…</option>
              ${PROVIDER_PRESETS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          ${list.map(p => `
            <div class="manage-item${p.id === this.selectedId ? ' active' : ''}" data-id="${p.id}">
              <div class="manage-item-title">${esc(p.name)}${p.isDefault ? ' <span class="badge">default</span>' : ''}</div>
              <div class="manage-item-meta">${esc(p.model || 'no model')} · ${p.apiType}${p.apiKey ? ' · key set' : ' · no key'}</div>
            </div>`).join('')}
        </div>
        <div class="manage-editor">${selected ? this.editorHtml() : '<div class="empty-hint">Add a provider to begin.</div>'}</div>
      </div>`
    this.bind()
  }

  private editorHtml(): string {
    const selected = this.selectedId ? this.providers.get(this.selectedId) : undefined
    if (!selected) return '<div class="empty-hint">Add a provider to begin.</div>'
    return `
      <div class="form">
        <div class="field"><label>Name</label><input id="pf-name" value="${esc(selected.name)}" /></div>
        <div class="field"><label>API type</label>
          <select id="pf-apitype">
            <option value="openai"${selected.apiType === 'openai' ? ' selected' : ''}>OpenAI-compatible</option>
            <option value="anthropic"${selected.apiType === 'anthropic' ? ' selected' : ''}>Anthropic</option>
          </select>
        </div>
        <div class="field"><label>Base URL</label><input id="pf-baseurl" value="${esc(selected.baseUrl)}" placeholder="https://api.example.com/v1" /></div>
        <div class="field"><label>API key</label><input id="pf-apikey" type="password" value="${esc(selected.apiKey)}" placeholder="sk-…" /></div>
        <div class="field"><label>Model</label><input id="pf-model" value="${esc(selected.model)}" placeholder="deepseek-chat" /></div>
        <div class="field inline"><input id="pf-default" type="checkbox"${selected.isDefault ? ' checked' : ''} /><label for="pf-default">Use as default provider</label></div>
        <div class="form-actions">
          <button class="btn" id="pf-save">Save</button>
          <button class="btn" id="pf-test">Test connection</button>
          <button class="btn btn-danger" id="pf-delete">Delete</button>
        </div>
        <div class="test-result" id="pf-test-result"></div>
      </div>`
  }

  private readForm(): ProviderConfig {
    const root = document.getElementById('view-settings')!
    return {
      id: this.selectedId ?? uid(),
      name: (root.querySelector('#pf-name') as HTMLInputElement).value.trim() || 'Provider',
      apiType: (root.querySelector('#pf-apitype') as HTMLSelectElement).value as ApiType,
      baseUrl: (root.querySelector('#pf-baseurl') as HTMLInputElement).value.trim(),
      apiKey: (root.querySelector('#pf-apikey') as HTMLInputElement).value,
      model: (root.querySelector('#pf-model') as HTMLInputElement).value.trim(),
      isDefault: (root.querySelector('#pf-default') as HTMLInputElement).checked,
    }
  }

  private bind(): void {
    const root = document.getElementById('view-settings')!
    root.querySelectorAll('.manage-item').forEach(el =>
      el.addEventListener('click', () => {
        this.selectedId = (el as HTMLElement).dataset.id ?? null
        this.render()
      }),
    )
    const addSelect = root.querySelector('#provider-preset-add') as HTMLSelectElement | null
    if (addSelect) {
      addSelect.addEventListener('change', () => {
        const idx = Number(addSelect.value)
        if (addSelect.value === '' || Number.isNaN(idx)) return
        const created = this.providers.createFromPreset(idx)
        this.selectedId = created.id
        terminal.log('info', `provider added: ${created.name}`)
        this.render()
      })
    }
    root.querySelector('#pf-save')?.addEventListener('click', () => {
      const p = this.readForm()
      this.providers.upsert(p)
      this.selectedId = p.id
      terminal.log('info', `provider saved: ${p.name}`)
      this.render()
    })
    const testBtn = root.querySelector('#pf-test') as HTMLButtonElement | null
    if (testBtn) {
      testBtn.addEventListener('click', () => void this.runTest(testBtn))
    }
    root.querySelector('#pf-delete')?.addEventListener('click', () => {
      if (!this.selectedId) return
      this.providers.remove(this.selectedId)
      this.selectedId = null
      this.render()
    })
  }

  private async runTest(btn: HTMLButtonElement): Promise<void> {
    const p = this.readForm()
    const result = document.getElementById('pf-test-result')
    btn.disabled = true
    btn.textContent = 'Testing…'
    try {
      const msg = await testProvider(p)
      if (result) {
        result.textContent = msg
        result.classList.remove('err')
      }
      terminal.log('info', `provider test ok: ${p.name}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (result) {
        result.textContent = msg
        result.classList.add('err')
      }
      terminal.log('err', `provider test failed: ${msg}`)
    } finally {
      btn.disabled = false
      btn.textContent = 'Test connection'
    }
  }
}
