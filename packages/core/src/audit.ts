import { z } from 'zod'

export const AuditEventSchema = z.object({
  agent: z.string().min(1),
  session_id: z.string().min(1),
  tool_call: z.string().min(1),
  decision: z.enum(['allow', 'deny', 'pause', 'fail_closed', 'degraded']),
  token: z.string().regex(/^aud-/)
})

export type AuditEvent = z.infer<typeof AuditEventSchema>
