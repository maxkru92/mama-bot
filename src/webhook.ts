import { ensureUser, markInbound, markInboundQueued } from './db'
import { recipientIsConfigured } from './processor'
import { verifyMetaSignature } from './lib/signature'
import type {
  IncomingMessage,
  MetaIncomingMessage,
  MetaWebhookPayload,
  QueueMessage
} from './types'

async function timingSafeEqualString(provided: string, expected: string): Promise<boolean> {
  // Hash both sides to a fixed 32-byte size first, so the input length is
  // not observable through comparison timing.
  const encoder = new TextEncoder()
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ])
  const providedBytes = new Uint8Array(providedHash)
  const expectedBytes = new Uint8Array(expectedHash)
  // Constant-time byte-wise comparison over the full fixed-size digests.
  let difference = 0
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
}

export async function verifyRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token') ?? ''
  const challenge = url.searchParams.get('hub.challenge')
  if (
    mode === 'subscribe' &&
    challenge &&
    (await timingSafeEqualString(token, env.WHATSAPP_VERIFY_TOKEN))
  ) {
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
    return new Response('Invalid JSON', { status: 400 })
  }

  const pending: Array<{ message: IncomingMessage; queue: QueueMessage }> = []
  for (const message of extractMessages(payload)) {
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
        JSON.stringify({
          event: 'inbound.publish_failed',
          error: error instanceof Error ? error.message : 'unknown error'
        })
      )
      return new Response('Queue unavailable', { status: 503 })
    }
  }
  return new Response('EVENT_RECEIVED', { status: 200 })
}
