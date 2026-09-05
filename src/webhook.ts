import { ensureUser, markInbound, markInboundQueued, pendingInbound } from './db'
import { recipientIsConfigured } from './processor'
import { getChannel } from './lib/channel'
import type { IncomingMessage, QueueMessage } from './types'

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const channel = getChannel(env)

  if (request.method === 'GET') {
    const response = channel.verifyGet(request, env)
    if (response) return response
    return new Response('Not found', { status: 404 })
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await request.arrayBuffer()
  const verification = channel.verifyPost(request, body, env)
  if (verification) return verification

  const pending: Array<{ message: IncomingMessage; queue: QueueMessage }> = []
  for (const message of channel.extractMessages(body)) {
    if (!(await recipientIsConfigured(env, message.phone))) continue
    if (!(await markInbound(env, message))) continue
    pending.push({
      message,
      queue: { kind: 'inbound', messageId: message.id, phone: message.phone, text: message.text }
    })
  }

  if (pending.length > 0) {
    try {
      for (let index = 0; index < pending.length; index += 100) {
        const chunk = pending.slice(index, index + 100)
        await env.INBOUND_QUEUE.sendBatch(chunk.map((entry) => ({ body: entry.queue })))
      }
      await Promise.all(pending.map((entry) => markInboundQueued(env, entry.message.id)))
    } catch (error) {
      console.error(
        'inbound queue publish failed',
        error instanceof Error ? error.message : 'unknown error'
      )
      return new Response('Queue unavailable', { status: 503 })
    }
  }
  return new Response('EVENT_RECEIVED', { status: 200 })
}

export async function prepareUser(env: Env): Promise<void> {
  await ensureUser(env, env.MOTHER_PHONE)
  for (const pendingMessage of await pendingInbound(env)) {
    await env.INBOUND_QUEUE.send({
      kind: 'inbound',
      messageId: pendingMessage.whatsapp_id,
      phone: pendingMessage.phone,
      text: pendingMessage.body
    })
  }
}
