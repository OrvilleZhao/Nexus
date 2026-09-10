import type { Message } from './types';
import { store } from './store';

export const chat = {
  render(sessionId: string) {
    const session = store.get(sessionId);
    const container = document.getElementById('chat-container');
    const empty = document.getElementById('chat-empty');
    if (!container || !session) return;

    if (session.messages.length === 0) {
      container.innerHTML = '';
      container.appendChild(empty!);
      empty!.style.display = 'flex';
      return;
    }

    empty!.style.display = 'none';
    container.innerHTML = session.messages.map(m => this.renderMessage(m)).join('');
    container.scrollTop = container.scrollHeight;
  },

  renderMessage(m: Message): string {
    if (m.role === 'user') {
      return `<div class="message message-user">
        <div class="message-bubble"><p>${this.esc(m.content)}</p></div>
      </div>`;
    }
    return `<div class="message message-assistant">
      <div class="message-avatar">N</div>
      <div class="message-bubble">${this.esc(m.content)}</div>
    </div>`;
  },

  append(sessionId: string, msg: Message) {
    const session = store.get(sessionId);
    if (!session) return;
    session.messages.push(msg);
    store.save();
    this.render(sessionId);
  },

  esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  },
};
