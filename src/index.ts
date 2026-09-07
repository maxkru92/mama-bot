import { processInbound, processOutbox } from './processor'
import { runScheduled } from './scheduler'
import type { QueueMessage } from './types'

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env))
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      const payload = message.body || {}
      try {
        if (payload.kind === 'inbound' && payload.text) {
          await processInbound(env, payload.phone, payload.text, payload.messageId)
        } else if (payload.kind === 'outbox' && payload.outboxId) {
          await processOutbox(env, payload.outboxId)
        }
        message.ack()
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'queue.processing_failed',
            kind: payload.kind,
            messageId: payload.messageId || payload.outboxId,
            error: error instanceof Error ? error.message : 'unknown error'
          })
        )
        message.retry()
      }
    }
  },

  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health' || url.pathname === '/health/config') {
      return new Response(
        JSON.stringify({
          ok: true,
          timestamp: new Date().toISOString(),
          channel: env.CHANNEL || 'callmebot',
          aiProvider: env.AI_PROVIDER || 'groq'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response('Mama Bot läuft stabil über Cron-Trigger und Queues! 🍝☕', { status: 200 })
  }
}
