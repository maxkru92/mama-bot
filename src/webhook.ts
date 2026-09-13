import { markInbound, markInboundQueueing, markInboundQueued } from './db'
import { normalizePhone } from './lib/phone'
import { timingSafeEqualString, verifyMetaSignature } from './lib/signature'
import type { IncomingMessage, MetaWebhookPayload } from './types'

export async function verifyWebhookRequest(request: Request, appSecret: string): Promise<boolean> {
  const body = await request.clone().arrayBuffer()
  return verifyMetaSignature(body, request.headers.get('x-hub-signature-256'), appSecret)
}

export function parseMetaMessages(payload: MetaWebhookPayload): IncomingMessage[] {
  const messages: IncomingMessage[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      for (const message of change.value?.messages ?? []) {
        if (
          message.type !== 'text' ||
          typeof message.id !== 'string' ||
          typeof message.from !== 'string' ||
          typeof message.timestamp !== 'string' ||
          typeof message.text?.body !== 'string' ||
          message.text.body.trim() === ''
        )
          continue
        const seconds = Number(message.timestamp)
        messages.push({
          id: message.id,
          phone: normalizePhone(message.from),
          text: message.text.body.trim(),
          timestamp: Number.isFinite(seconds)
            ? new Date(seconds * 1000).toISOString()
            : new Date().toISOString()
        })
      }
    }
  }
  return messages
}

async function enqueueIncomingMessages(messages: IncomingMessage[], env: Env): Promise<void> {
  const configuredPhone = normalizePhone(env.MOTHER_PHONE)
  for (const message of messages) {
    if (message.phone !== configuredPhone) continue
    if (!(await markInbound(env, message))) continue
    try {
      await env.INBOUND_QUEUE.send({
        kind: 'inbound',
        messageId: message.id,
        phone: message.phone,
        text: message.text
      })
      await markInboundQueued(env, message.id)
    } catch (error) {
      await markInboundQueueing(env, message.id)
      console.error(
        JSON.stringify({
          event: 'inbound.publish_failed',
          messageId: message.id,
          error: error instanceof Error ? error.message : 'unknown error'
        })
      )
    }
  }
}

export async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (
      mode === 'subscribe' &&
      challenge &&
      token &&
      env.WHATSAPP_VERIFY_TOKEN &&
      (await timingSafeEqualString(token, env.WHATSAPP_VERIFY_TOKEN))
    ) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!env.META_APP_SECRET) return new Response('Webhook secret is not configured', { status: 503 })
  if (!(await verifyWebhookRequest(request, env.META_APP_SECRET))) {
    return new Response('Invalid signature', { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as MetaWebhookPayload | null
  if (!payload || payload.object !== 'whatsapp_business_account') {
    return new Response('EVENT_RECEIVED', { status: 200 })
  }

  const messages = parseMetaMessages(payload)
  ctx.waitUntil(enqueueIncomingMessages(messages, env))
  return new Response('EVENT_RECEIVED', { status: 200 })
}
