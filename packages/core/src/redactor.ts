export interface RedactionRule {
  id: string
  pattern: RegExp
  replacement: string
}

export const REDACTION_RULES: readonly RedactionRule[] = [
  {
    id: 'aws-access-key',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED:aws-access-key]'
  },
  {
    id: 'secret-key',
    pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
    replacement: '[REDACTED:secret-key]'
  },
  {
    id: 'bearer-token',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/g,
    replacement: 'Bearer [REDACTED:token]'
  },
  {
    id: 'password-assignment',
    pattern: /\b(?:password|passwd|pwd|secret)\b\s*[:=]\s*[^\s,;]+/gi,
    replacement: '[REDACTED:password-assignment]'
  },
  {
    id: 'internal-ip',
    pattern:
      /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
    replacement: '[REDACTED:internal-ip]'
  },
  {
    id: 'internal-domain',
    pattern: /\b(?:[a-z0-9-]+\.)+(?:internal|corp|local|lan)\b/gi,
    replacement: '[REDACTED:internal-domain]'
  }
]

export interface RedactionResult {
  content: string
  applied: string[]
}

export function redactContent(content: string): RedactionResult {
  let out = content
  const applied: string[] = []
  for (const rule of REDACTION_RULES) {
    const next = out.replace(rule.pattern, rule.replacement)
    if (next !== out) {
      applied.push(rule.id)
      out = next
    }
  }
  return { content: out, applied }
}
