import { store } from './store';
import { chat } from './chat';
import { terminal } from './terminal';

const RESPONSES = [
  "I'll help you with that. Let me analyze the codebase first.",
  "Running `pnpm typecheck` — all packages pass. No type errors found.",
  "The AuditEngine dual-perspective query returned 3 sessions, 12 turns total.",
  "Injection budget: 2000 tokens available, 1247 used after trajectory sync.",
  "Funes recall returned 5 relevant turns from the last 3 sessions.",
  "PEP interception: static rule matched — ALLOWED. No PDP call needed.",
  "Trajectory saved. sha256: a3f8c2d1... dedup verified.",
  "PauseHandler: file queue has 2 pending approvals. Use `respond` to action.",
];

function initSessions() {
  store.load();
  renderSessionList();
  if (store.sessions.length === 0) {
    const s = store.create();
    store.current = s;
    chat.render(s.id);
    updateStatus(s);
  } else {
    store.current = store.sessions[0];
    chat.render(store.current.id);
    updateStatus(store.current);
  }
}

function renderSessionList() {
  const list = document.getElementById('session-list');
  if (!list) return;
  list.innerHTML = store.sessions.map(s => {
    const active = s.id === store.current?.id ? ' active' : '';
    const time = new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `<div class="session-item${active}" data-id="${s.id}">
      <div class="session-title">${esc(s.title)}</div>
      <div class="session-meta">${time} · ${s.messages.length} messages</div>
    </div>`;
  }).join('');

  list.querySelectorAll('.session-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.id!;
      store.current = store.get(id) ?? null;
      if (store.current) {
        chat.render(store.current.id);
        updateStatus(store.current);
      }
      renderSessionList();
    });
  });
}

function updateStatus(s: { id: string; title: string; messages: { length: number } }) {
  const el = document.getElementById('session-label');
  if (el) el.textContent = s.title;
  const pkg = document.getElementById('pkg-count');
  if (pkg) pkg.textContent = `${store.sessions.length} sessions`;
}

function setupInput() {
  const input = document.getElementById('chat-input') as HTMLTextAreaElement;
  const btn = document.getElementById('btn-send') as HTMLButtonElement;

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    btn.disabled = input.value.trim().length === 0;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!btn.disabled) send();
    }
  });

  btn.addEventListener('click', send);
}

function send() {
  const input = document.getElementById('chat-input') as HTMLTextAreaElement;
  const text = input.value.trim();
  if (!text || !store.current) return;

  // Update title on first message
  if (store.current.messages.length === 0) {
    store.current.title = text.slice(0, 48);
    renderSessionList();
    updateStatus(store.current);
  }

  // User message
  const userMsg = {
    id: crypto.randomUUID(),
    role: 'user' as const,
    content: text,
    timestamp: Date.now(),
  };
  chat.append(store.current.id, userMsg);
  terminal.log('cmd', `> ${text}`);

  input.value = '';
  input.style.height = 'auto';
  (document.getElementById('btn-send') as HTMLButtonElement).disabled = true;

  // Simulate assistant response
  setTimeout(() => {
    const resp = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    const assistantMsg = {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: resp,
      timestamp: Date.now(),
    };
    if (store.current) {
      chat.append(store.current.id, assistantMsg);
      terminal.log('out', resp);
    }
  }, 300 + Math.random() * 700);
}

function setupNewSession() {
  document.getElementById('btn-new-session')?.addEventListener('click', () => {
    const s = store.create();
    store.current = s;
    renderSessionList();
    chat.render(s.id);
    updateStatus(s);
    document.getElementById('chat-input')?.focus();
  });
}

function esc(s: string) { return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Boot
document.addEventListener('DOMContentLoaded', () => {
  terminal.init();
  terminal.log('info', 'Nexus Desktop v0.1.0 — ready');
  terminal.log('info', 'Packages: core, bridge, memory, adapter-dsh, adapter-omnigent, sdk');
  initSessions();
  setupInput();
  setupNewSession();
  document.getElementById('chat-input')?.focus();
});
