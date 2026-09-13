import { browserStorage, esc } from './util.js'
import { ProviderStore } from './providers.js'
import { AgentStore } from './agents.js'
import { PluginStore } from './plugins.js'
import { store } from './store.js'
import { terminal } from './terminal.js'
import { initChat, refreshChatUi } from './views/chat.js'
import { AgentsView } from './views/agents.js'
import { PluginsView } from './views/plugins.js'
import { SettingsView } from './views/settings.js'

const providers = new ProviderStore(browserStorage())
const agents = new AgentStore(browserStorage())
const plugins = new PluginStore(browserStorage())
providers.seed()
agents.seed(providers.default()?.id ?? '')

const agentsView = new AgentsView(agents, providers)
const pluginsView = new PluginsView(plugins)
const settingsView = new SettingsView(providers)

const VIEW_NAMES = ['chat', 'agents', 'plugins', 'settings'] as const

function renderSessionList(): void {
  const list = document.getElementById('session-list')
  if (!list) return
  list.innerHTML = store.sessions.map(s => {
    const active = s.id === store.current?.id ? ' active' : ''
    const time = new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    return `<div class="session-item${active}" data-id="${s.id}">
      <div class="session-title">${esc(s.title)}</div>
      <div class="session-meta">${time} · ${s.messages.length} messages</div>
    </div>`
  }).join('')
  list.querySelectorAll('.session-item').forEach(el =>
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.id!
      store.current = store.get(id) ?? null
      renderSessionList()
      refreshChatUi()
    }),
  )
  const foot = document.getElementById('foot-left')
  if (foot) foot.textContent = `${store.sessions.length} chats · ${agents.list().length} agents`
}

function switchView(name: string): void {
  for (const v of VIEW_NAMES) {
    document.getElementById(`view-${v}`)?.classList.toggle('hidden', v !== name)
  }
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', (el as HTMLElement).dataset.view === name),
  )
  if (name === 'agents') agentsView.render()
  if (name === 'plugins') pluginsView.render()
  if (name === 'settings') settingsView.render()
  if (name === 'chat') refreshChatUi()
}

document.addEventListener('DOMContentLoaded', () => {
  terminal.init()
  terminal.log('info', 'Nexus Desktop v0.1.0 — ready')
  terminal.log('info', `providers: ${providers.list().length} · agents: ${agents.list().length}`)

  store.load()
  if (store.sessions.length === 0) {
    store.current = store.create()
  } else {
    store.current = store.sessions[0] ?? null
  }
  renderSessionList()

  initChat({ providers, agents, plugins })
  refreshChatUi()
  switchView('chat')

  document.querySelectorAll('.nav-item').forEach(el =>
    el.addEventListener('click', () => switchView((el as HTMLElement).dataset.view ?? 'chat')),
  )
  document.getElementById('btn-new-session')?.addEventListener('click', () => {
    store.current = store.create()
    renderSessionList()
    refreshChatUi()
    switchView('chat')
    document.getElementById('chat-input')?.focus()
  })
  window.addEventListener('nexus:session-updated', () => renderSessionList())
  document.getElementById('chat-input')?.focus()
})
