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
        missing: status.ok ? [] : (status.missing ?? []),
      })
    }
    if (url.pathname === '/webhook' || url.pathname === '/api/whatsapp') {
      return handleWebhook(request, env)
    }
    if (url.pathname === '/health/config' && request.method === 'GET') {
      let d1Configured = Boolean(env.DB)
      let queueConfigured = Boolean(env.INBOUND_QUEUE)
      if (d1Configured) {
        try {
          await env.DB.prepare('SELECT 1').first()
        } catch {
          d1Configured = false
        }
      }
      const status = configurationStatus(env)
      const ok = status.ok && d1Configured && queueConfigured
      return json({
        ok,
        service: 'mama-bot',
        configured: ok,
        missing: status.ok ? [] : (status.missing ?? []),
        d1Configured,
        queueConfigured
      }, ok ? 200 : 503)
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

  async queue(batch: MessageBatch<QueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    const SEMAPHORE = 3
    const messages = batch.messages
    const chunks: typeof messages[] = []
    for (let index = 0; index < messages.length; index += SEMAPHORE) {
      chunks.push(messages.slice(index, index + SEMAPHORE))
    }
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map((message) => {
          return (async () => {
            if (message.body.kind === 'inbound' && message.body.text) {
              message.ack()
              await processInbound(env, message.body.phone, message.body.text, message.body.messageId)
            } else if (message.body.kind === 'outbox' && message.body.outboxId) {
              message.ack()
              await processOutbox(env, message.body.outboxId)
            } else {
              message.ack()
            }
          })()
        })
      )
    }
  }
}
