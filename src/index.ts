import { runScheduled } from './scheduler'
import { processInbound, processOutbox } from './processor'
import { handleWebhook } from './webhook'
import type { QueueMessage } from './types'
import { configurationStatus } from './config/env'

const json = (body: unknown, status = 200): Response => Response.json(body, { status })

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health' && request.method === 'GET') {
      const status = configurationStatus(env)
      return json({
        ok: true,
        service: 'mama-bot',
        configured: status.ok,
        missing: status.ok ? [] : (status.missing ?? [])
      })
    }
    if (url.pathname === '/webhook' || url.pathname === '/api/whatsapp') {
      return handleWebhook(request, env)
    }
    if (url.pathname === '/health/config' && request.method === 'GET') {
      const status = configurationStatus(env)
      return json(status, status.ok ? 200 : 503)
    }
    return json({ error: 'Not found' }, 404)
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runScheduled(env))
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (message.body.kind === 'inbound' && message.body.text) {
          await processInbound(env, message.body.phone, message.body.text, message.body.messageId)
        } else if (message.body.kind === 'outbox' && message.body.outboxId) {
          await processOutbox(env, message.body.outboxId)
        }
        message.ack()
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'queue.processing_failed',
            kind: message.body.kind,
            messageId: message.body.messageId,
            error: error instanceof Error ? error.message : 'unknown error'
          })
        )
        message.retry()
      }
    }
  }
}
