import { store } from '../store.js'
import { terminal } from '../terminal.js'
import { chatCompletion } from '../api.js'
import { uid, esc } from '../util.js'
import type { ProviderStore } from '../providers.js'
import type { AgentStore } from '../agents.js'
import type { PluginStore } from '../plugins.js'
import type { Message } from '../types.js'

export interface ChatDeps {
  providers: ProviderStore
  agents: AgentStore
  plugins: PluginStore
}

let deps: ChatDeps | null = null
let sending = false

export function initChat(d: ChatDeps): void {
  deps = d
  const select = document.getElementById('agent-select') as HTMLSelectElement
  select.addEventListener('change', () => {
    if (store.current) {
      store.current.agentId = select.value
      store.save()
    }
    updateModelStatus()
  })
  const input = document.getElementById('chat-input') as HTMLTextAreaElement
  const btn = document.getElementById('btn-send') as HTMLButtonElement
  input.addEventListener('input', () => {
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 150) + 'px'
    btn.disabled = input.value.trim().length === 0 || sending
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!btn.disabled) void send()
    }
  })
  btn.addEventListener('click', () => void send())
}

export function refreshChatUi(): void {
  renderAgentSelect()
  renderMessages()
  updateModelStatus()
}

function currentAgent() {
  const d = deps
  if (!d) return undefined
  const id = store.current?.agentId
  return d.agents.get(id ?? '') ?? d.agents.list()[0]
}

function renderAgentSelect(): void {
  const d = deps
  if (!d) return
  const select = document.getElementById('agent-select') as HTMLSelectElement
  const list = d.agents.list()
  const cur = currentAgent()
  select.innerHTML =
    list
      .map(a => `<option value="${a.id}"${cur && a.id === cur.id ? ' selected' : ''}>${esc(a.name)}</option>`)
      .join('') || '<option value="">No agents</option>'
}

function updateModelStatus(): void {
  const el = document.getElementById('status-model')
  const d = deps
  const a = currentAgent()
  if (!d || !a) {
    if (el) el.textContent = 'No agent'
    return
  }
  const p = d.providers.get(a.providerId)
  if (!p) {
    if (el) el.textContent = `${a.name} — no provider`
    return
  }
  const model = a.model.trim() || p.model
  if (el) el.textContent = `${p.name} / ${model}`
}

function renderMessages(): void {
  const container = document.getElementById('chat-container')
  if (!container) return
  const session = store.current
  if (!session || session.messages.length === 0) {
    container.innerHTML = `<div class="chat-empty">
      <div class="chat-empty-icon">&#9670;</div>
      <h3>Nexus Desktop</h3>
      <p>Add an API key in Providers, pick an agent above, then start chatting.</p>
    </div>`
    return
  }
  container.innerHTML = session.messages.map(m => messageHtml(m)).join('')
  container.scrollTop = container.scrollHeight
}

function messageHtml(m: Message): string {
  if (m.role === 'user') {
    return `<div class="message message-user"><div class="message-bubble"><p>${esc(m.content)}</p></div></div>`
  }
  const err = m.isError ? ' message-error' : ''
  return `<div class="message message-assistant${err}"><div class="message-avatar">N</div><div class="message-bubble">${esc(m.content)}</div></div>`
}

function addThinking(): HTMLElement {
  const container = document.getElementById('chat-container')!
  const div = document.createElement('div')
  div.className = 'message message-assistant'
  div.innerHTML = '<div class="message-avatar">N</div><div class="message-bubble thinking">Thinking…</div>'
  container.appendChild(div)
  container.scrollTop = container.scrollHeight
  return div
}

function appendErrorToChat(text: string): void {
  if (!store.current) return
  store.current.messages.push({ id: uid(), role: 'assistant', content: text, timestamp: Date.now(), isError: true })
  store.save()
  renderMessages()
  terminal.log('err', text)
}

async function send(): Promise<void> {
  if (!deps || sending || !store.current) return
  const input = document.getElementById('chat-input') as HTMLTextAreaElement
  const btn = document.getElementById('btn-send') as HTMLButtonElement
  const text = input.value.trim()
  if (!text) return

  const agent = currentAgent()
  if (!agent) {
    appendErrorToChat('No agent available — create one in the Agents view.')
    return
  }
  const provider = deps.providers.get(agent.providerId)
  if (!provider) {
    appendErrorToChat('This agent has no provider — assign one in the Agents view.')
    return
  }
  if (!provider.apiKey) {
    appendErrorToChat(`Provider "${provider.name}" has no API key — add one in the Providers view.`)
    return
  }

  sending = true
  btn.disabled = true
  const session = store.current
  session.messages.push({ id: uid(), role: 'user', content: text, timestamp: Date.now() })
  if (session.messages.length === 1) {
    session.title = text.slice(0, 48)
    window.dispatchEvent(new CustomEvent('nexus:session-updated'))
  }
  store.save()
  renderMessages()
  terminal.log('cmd', `> ${text}`)
  const thinking = addThinking()

  const payload = [
    { role: 'system', content: agent.systemPrompt },
    ...session.messages.map(m => ({ role: m.role, content: m.content })),
  ]
  const model = agent.model.trim() || provider.model

  try {
    const reply = await chatCompletion(provider, agent.model, payload)
    thinking.remove()
    session.messages.push({ id: uid(), role: 'assistant', content: reply, timestamp: Date.now() })
    store.save()
    if (store.current?.id === session.id) renderMessages()
    terminal.log('out', reply)
    if (deps.plugins.isEnabled('nexus.audit.log')) {
      terminal.audit(
        JSON.stringify({
          ts: new Date().toISOString(),
          provider: provider.name,
          model,
          decision: 'allow',
          token: `aud-${uid().slice(0, 8)}`,
        }),
      )
    }
    if (deps.plugins.isEnabled('nexus.terminal.verbose')) {
      terminal.log('info', `payload ${payload.length} msgs · ${provider.name}/${model} · reply ${reply.length} chars`)
    }
  } catch (e) {
    thinking.remove()
    const msg = e instanceof Error ? e.message : String(e)
    session.messages.push({ id: uid(), role: 'assistant', content: `Error: ${msg}`, timestamp: Date.now(), isError: true })
    store.save()
    if (store.current?.id === session.id) renderMessages()
    terminal.log('err', msg)
  } finally {
    sending = false
    input.value = ''
    input.style.height = 'auto'
    btn.disabled = true
  }
}
