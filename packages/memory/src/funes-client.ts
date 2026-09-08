import { execFile } from 'node:child_process'
import type { SpawnOptions } from 'node:child_process'

export interface RecallHit {
  score: number
  sessionId: string
  turnId: string
  text: string
  blockType: string
}

export interface RecallResult {
  hits: RecallHit[]
}

export interface RecallOptions {
  k?: number
  candidates?: number
  halfLife?: number
  neighbors?: number
  type?: string
  harness?: string
  memory?: string
}

export interface GetOptions {
  window?: number
  memory?: string
}

export type ExecFn = (
  command: string,
  args: string[],
  options: SpawnOptions & { encoding: 'utf-8' }
) => Promise<{ stdout: string }>

export interface FunesClientOptions {
  exec?: ExecFn
  memory?: string
}

export class FunesClient {
  private readonly exec: ExecFn
  private readonly memory: string

  constructor(opts: FunesClientOptions = {}) {
    this.memory = opts.memory ?? 'local'
    this.exec = opts.exec ?? defaultExec
  }

  async recall(query: string, opts: RecallOptions = {}): Promise<RecallResult> {
    const args = ['recall', query]
    if (opts.k !== undefined) args.push('-k', String(opts.k))
    if (opts.candidates !== undefined) args.push('--candidates', String(opts.candidates))
    if (opts.halfLife !== undefined) args.push('--half-life', String(opts.halfLife))
    if (opts.neighbors !== undefined) args.push('--neighbors', String(opts.neighbors))
    if (opts.type !== undefined) args.push('--type', opts.type)
    if (opts.harness !== undefined) args.push('--harness', opts.harness)
    args.push('--memory', opts.memory ?? this.memory)

    const { stdout } = await this.exec('funes', args, { encoding: 'utf-8' })
    return parseRecallOutput(stdout)
  }

  async get(sessionId: string, turnId: string, opts: GetOptions = {}): Promise<string> {
    const args = ['get', sessionId, turnId]
    if (opts.window !== undefined) args.push('--window', String(opts.window))
    args.push('--memory', opts.memory ?? this.memory)
    const { stdout } = await this.exec('funes', args, { encoding: 'utf-8' })
    return stdout
  }

  async status(): Promise<string> {
    const { stdout } = await this.exec('funes', ['status', '--memory', this.memory], { encoding: 'utf-8' })
    return stdout
  }
}

const HIT_RE = /^\[(\d+)\]\s*\/\s*(\S+)\s+score=([0-9.]+)/
const GET_LINE_RE = /^→\s+get\s+(\S+)\s+(\S+)\s+--memory\s+(\S+)/

function parseRecallOutput(raw: string): RecallResult {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === 'no results') return { hits: [] }

  const blocks = trimmed.split(/\n---\n/)
  const hits: RecallHit[] = []

  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim() !== '')
    if (lines.length < 2) continue

    const hitMatch = lines[0]!.match(HIT_RE)
    if (hitMatch === null) continue

    const getMatch = lines[1]!.match(GET_LINE_RE)
    if (getMatch === null) continue

    const text = lines.slice(2).join('\n').trim()

    hits.push({
      score: parseFloat(hitMatch[3]!),
      blockType: hitMatch[2]!,
      sessionId: getMatch[1]!,
      turnId: getMatch[2]!,
      text
    })
  }

  return { hits }
}

/* v8 ignore next 15 */
function defaultExec(
  command: string,
  args: string[],
  options: SpawnOptions & { encoding: 'utf-8' }
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout) => {
      if (error !== null) {
        reject(error)
        return
      }
      resolve({ stdout: stdout as string })
    })
  })
}
