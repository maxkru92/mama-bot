import { verifyMetaSignature } from './signature'
import { sendWhatsAppText } from './whatsapp'
import type { IncomingMessage, MetaWebhookPayload, MetaIncomingMessage } from '../types'

function extractMetaMessages(payload: MetaWebhookPayload): IncomingMessage[] {
  const messages: IncomingMessage[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const normalized = normalizeMetaMessage(message)
        if (normalized) messages.push(normalized)
      }
    }
  }
  return messages
}

function normalizeMetaMessage(message: MetaIncomingMessage): IncomingMessage | null {
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

export interface Channel {
  name: string
  verifyGet(request: Request, env: Env): Response | null
  verifyPost(request: Request, body: ArrayBuffer, env: Env): Response | null
  extractMessages(body: ArrayBuffer): IncomingMessage[]
  sendText(env: Env, recipient: string, text: string): Promise<string>
}

export const metaChannel: Channel = {
  name: 'meta',

  verifyGet(request: Request, env: Env): Response | null {
    const url = new URL(request.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  },

  verifyPost(request: Request, body: ArrayBuffer, env: Env): Response | null {
    if (!env.META_APP_SECRET) {
      return new Response('Webhook secret is not configured', { status: 503 })
    }
    const signature = request.headers.get('x-hub-signature-256')
    const valid = verifyMetaSignature(body, signature, env.META_APP_SECRET)
    if (!valid) return new Response('Invalid signature', { status: 401 })
    return null
  },

  extractMessages(body: ArrayBuffer): IncomingMessage[] {
    let payload: MetaWebhookPayload
    try {
      payload = JSON.parse(new TextDecoder().decode(body)) as MetaWebhookPayload
    } catch {
      return []
    }
    return extractMetaMessages(payload)
  },

  async sendText(env: Env, recipient: string, text: string): Promise<string> {
    return sendWhatsAppText(env, recipient, text)
  }
}

export const callmebotChannel: Channel = {
  name: 'callmebot',

  verifyGet(request: Request, env: Env): Response | null {
    return new Response('CallMeBot GET not implemented', { status: 501 })
  },

  verifyPost(request: Request, body: ArrayBuffer, env: Env): Response | null {
    const apiKey =
      request.headers.get('x-callmebot-apikey') || new URL(request.url).searchParams.get('apikey')
    if (!apiKey || apiKey !== env.CALLMEBOT_API_KEY) {
      return new Response('Invalid CallMeBot API key', { status: 401 })
    }
    return null
  },

  extractMessages(body: ArrayBuffer): IncomingMessage[] {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>
    } catch {
      return []
    }
    const from = String(payload.from || payload.sender || '').replace(/^\+/, '')
    const text = String(payload.text || payload.message || '')
    const id = String(payload.messageId || payload.id || `${Date.now()}`)
    if (!from || !text) return []
    return [
      {
        id,
        phone: from,
        text: text.trim(),
        timestamp: new Date().toISOString()
      }
    ]
  },

  async sendText(env: Env, recipient: string, text: string): Promise<string> {
    const apiKey = env.CALLMEBOT_API_KEY
    if (!apiKey) throw new Error('CALLMEBOT_API_KEY not configured')
    const encodedText = encodeURIComponent(text.slice(0, 4000))
    const url = `https://api.callmebot.com/sendmsg?text=${encodedText}&user=${encodeURIComponent(recipient)}&apikey=${apiKey}`
    const response = await fetch(url)
    const body = await response.text()
    if (!response.ok || body.includes('ERROR')) {
      throw new Error(`CallMeBot send failed: ${body}`)
    }
    return `callmebot-${Date.now()}`
  }
}

export function getChannel(env: Env): Channel {
  const channel = (env.CHANNEL || 'meta') as string
  if (channel === 'callmebot') {
    return callmebotChannel
  }
  return metaChannel
}
