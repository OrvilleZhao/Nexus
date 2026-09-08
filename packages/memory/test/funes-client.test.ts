import { describe, it, expect, vi } from 'vitest'
import { FunesClient } from '../src/funes-client.js'

describe('FunesClient', () => {
  it('recall 调用 funes recall 子进程并解析输出', async () => {
    const output = [
      '[1] / text score=0.92',
      '→ get sess-1 turn-aaa --memory local',
      '',
      'The parser uses streaming SSE',
      '---',
      '',
      '[2] / text score=0.85',
      '→ get sess-1 turn-bbb --memory local',
      '',
      'Config: timeout 30s',
      '---',
      ''
    ].join('\n')
    const exec = vi.fn().mockResolvedValue({ stdout: output })
    const client = new FunesClient({ exec })
    const result = await client.recall('what is the parser config?')
    expect(result.hits).toHaveLength(2)
    expect(result.hits[0]!.score).toBeCloseTo(0.92)
    expect(result.hits[0]!.sessionId).toBe('sess-1')
    expect(result.hits[0]!.turnId).toBe('turn-aaa')
    expect(result.hits[0]!.text).toContain('streaming SSE')
    expect(result.hits[1]!.score).toBeCloseTo(0.85)
  })

  it('recall 在 no results 时返回空 hits', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'no results\n' })
    const client = new FunesClient({ exec })
    const result = await client.recall('obscure query')
    expect(result.hits).toHaveLength(0)
  })

  it('recall 支持 k/candidates/half_life 参数', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'no results\n' })
    const client = new FunesClient({ exec })
    await client.recall('test', { k: 4, candidates: 15, halfLife: 10 })
    expect(exec).toHaveBeenCalledWith(
      'funes',
      ['recall', 'test', '-k', '4', '--candidates', '15', '--half-life', '10', '--memory', 'local'],
      expect.anything()
    )
  })

  it('recall 在子进程错误时 throw（fail-closed）', async () => {
    const exec = vi.fn().mockRejectedValue(new Error('funes not found'))
    const client = new FunesClient({ exec })
    await expect(client.recall('test')).rejects.toThrow('funes not found')
  })

  it('recall 在畸形输出时返回空 hits（无有效块）', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'not valid agent format @#$%' })
    const client = new FunesClient({ exec })
    const result = await client.recall('test')
    expect(result.hits).toHaveLength(0)
  })

  it('get 调用 funes get 并返回原始文本', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'Turn content here\n---\n' })
    const client = new FunesClient({ exec })
    const text = await client.get('sess-1', 'turn-aaa')
    expect(text).toContain('Turn content here')
    expect(exec).toHaveBeenCalledWith(
      'funes',
      ['get', 'sess-1', 'turn-aaa', '--memory', 'local'],
      expect.anything()
    )
  })

  it('get 支持 window 和 memory 参数', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'context\n' })
    const client = new FunesClient({ exec })
    await client.get('s', 't', { window: 5, memory: 'hf://user/repo' })
    expect(exec).toHaveBeenCalledWith(
      'funes',
      ['get', 's', 't', '--window', '5', '--memory', 'hf://user/repo'],
      expect.anything()
    )
  })

  it('构造函数接受 memory 标签覆盖默认 local', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'no results\n' })
    const client = new FunesClient({ exec, memory: 'hf://custom/mem' })
    await client.recall('q')
    expect(exec).toHaveBeenCalledWith(
      'funes',
      ['recall', 'q', '--memory', 'hf://custom/mem'],
      expect.anything()
    )
  })

  it('status 返回 funes status 输出', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'Memory: local (3 turns)\n' })
    const client = new FunesClient({ exec })
    const status = await client.status()
    expect(status).toContain('Memory: local')
  })
})
