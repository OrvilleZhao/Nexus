import type { TerminalTab } from './types';

interface LogEntry {
  ts: string;
  type: 'info' | 'cmd' | 'out' | 'err';
  text: string;
}

let activeTab: TerminalTab = 'output';
const outputEntries: LogEntry[] = [];
const auditEntries: LogEntry[] = [];

function fmt(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export const terminal = {
  init() {
    document.querySelectorAll('.terminal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = (tab as HTMLElement).dataset.tab as TerminalTab;
        document.querySelectorAll('.terminal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.render();
      });
    });
  },

  log(type: LogEntry['type'], text: string) {
    outputEntries.push({ ts: fmt(), type, text });
    if (activeTab === 'output') this.render();
  },

  audit(text: string) {
    auditEntries.push({ ts: fmt(), type: 'out', text });
    if (activeTab === 'audit') this.render();
  },

  render() {
    const el = document.getElementById('terminal-output');
    if (!el) return;
    const entries = activeTab === 'output' ? outputEntries : auditEntries;
    el.innerHTML = entries.map(e =>
      `<div class="terminal-line"><span class="ts">[${e.ts}]</span> <span class="${e.type}">${this.esc(e.text)}</span></div>`
    ).join('');
    el.scrollTop = el.scrollHeight;
  },

  esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};
