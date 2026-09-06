import { ensureUser, markInbound, markInboundQueued, pendingInbound } from './db'
import { recipientIsConfigured } from './processor'
import { verifyMetaSignature } from './lib/signature'
import { logError } from './lib/logger'
import type {
  IncomingMessage,
  MetaIncomingMessage,
  MetaWebhookPayload,
  QueueMessage
} from './types'

export function verifyRequest(request: Request, env: Env): Response {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

function extractMessages(payload: MetaWebhookPayload): IncomingMessage[] {
  const messages: IncomingMessage[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const normalized = normalizeMessage(message)
        if (normalized) messages.push(normalized)
      }
    }
  }
  return messages
}

function normalizeMessage(message: MetaIncomingMessage): IncomingMessage | null {
  if (message.type !== 'text' || !message.id || !message.from || !message.text?.body) return null
  return {
    id: message.id,
    phone: message.from,
    text: message.text.body.trim(),
    timestamp: message.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : new Date().toISOString()
  }
}

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return verifyRequest(request, env)
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!env.META_APP_SECRET) return new Response('Webhook secret is not configured', { status: 503 })

  const body = await request.arrayBuffer()
  const valid = await verifyMetaSignature(
    body,
    request.headers.get('x-hub-signature-256'),
    env.META_APP_SECRET
  )
  if (!valid) return new Response('Invalid signature', { status: 401 })

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(body)) as MetaWebhookPayload
  } catch {
    const snippet = new TextDecoder().decode(body.slice(0, 200))
    logError('Invalid JSON payload', new Error('JSON parse failed'), { snippet, length: body.byteLength })
    return new Response('Invalid JSON', { status: 400 })
  }

  const pending: Array<{ message: IncomingMessage; queue: QueueMessage }> = []
  for (const message of extractMessages(payload)) {
    if (!(await recipientIsConfigured(env, message.phone))) {
      logError('recipient not configured', new Error('recipient mismatch'), { phone: message.phone })
      continue
    }
    if (!(await markInbound(env, message))) {
      logError('inbound duplicate or invalid state', new Error('markInbound returned false'), { messageId: message.id, phone: message.phone })
      continue
    }
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
      logError('inbound queue publish failed', error)
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
