import { Bench } from 'tinybench'
import { parsePolicyQuery } from '@nexus/core'
import { MockPdp } from '@nexus/contracts'
import { Pep } from '../src/index.js'

const P99_BUDGET_MS = 20

const query = parsePolicyQuery({
  request_id: 'req-bench',
  policy_version: 'omnigent-policy-v1',
  subject: { kind: 'agent', name: 'nexus-dev-01', session_id: 'sess-bench' },
  action: { type: 'tool_call', tool: 'shell', args_meta: { cmd_class: 'file_write' } },
  resource: { type: 'file', path: '/repo/src/main.go' }
})

const pdp = new MockPdp({
  decisions: [{ decision: 'allow', reason_code: 'BENCH', ttl_seconds: 3600, audit_token: 'aud-bench-1' }]
})
const pep = new Pep({ pdp })

const bench = new Bench({ iterations: 2000 })
bench.add('pep cache-hit intercept', async () => {
  await pep.intercept(query)
})

await bench.run()
console.table(bench.table())

const p99 = bench.getTask('pep cache-hit intercept')?.result?.p99 ?? Number.POSITIVE_INFINITY
if (p99 >= P99_BUDGET_MS) {
  console.error(`FAIL: cache-hit p99 ${p99.toFixed(3)}ms >= ${P99_BUDGET_MS}ms budget`)
  process.exit(1)
}
console.log(`OK: cache-hit p99 ${p99.toFixed(3)}ms < ${P99_BUDGET_MS}ms budget`)
