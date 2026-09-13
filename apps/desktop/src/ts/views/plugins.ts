import type { PluginStore } from '../plugins.js'
import { esc } from '../util.js'

export class PluginsView {
  constructor(private readonly plugins: PluginStore) {}

  render(): void {
    const root = document.getElementById('view-plugins')
    if (!root) return
    root.innerHTML = `<div class="plugin-list">
      ${this.plugins.defs().map(d => `
        <div class="plugin-row${d.requiresBackend ? ' locked' : ''}">
          <div class="plugin-info">
            <div class="plugin-name">${esc(d.name)}${d.requiresBackend ? '<span class="badge">requires backend</span>' : ''}</div>
            <div class="plugin-desc">${esc(d.description)}</div>
          </div>
          <label class="toggle">
            <input type="checkbox" data-plugin="${d.id}"${this.plugins.isEnabled(d.id) ? ' checked' : ''}${d.requiresBackend ? ' disabled' : ''} />
            <span class="slider"></span>
          </label>
        </div>`).join('')}
    </div>`
    root.querySelectorAll('input[data-plugin]').forEach(el =>
      el.addEventListener('change', () => {
        const input = el as HTMLInputElement
        const id = input.dataset.plugin!
        this.plugins.setEnabled(id, input.checked)
      }),
    )
  }
}
