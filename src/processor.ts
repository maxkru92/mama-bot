import { generateReply } from './lib/ai'
import { commandFor, helpText, safetyPrefix } from './lib/commands'
import { sendWhatsAppText } from './lib/whatsapp'
import {
  claimInbound,
  claimOutbox,
  enqueueOutbox,
  ensureUser,
  markInboundProcessed,
  markOutboxFailed,
  markOutboxSent,
  recentMessages,
  updateProactive
} from './db'

export async function processInbound(
  env: Env,
  phone: string,
  text: string,
  messageId: string
): Promise<void> {
  if (!(await claimInbound(env, messageId))) return
  const user = await ensureUser(env, phone)
  const command = commandFor(text)
  let body: string
  if (command === 'stop') {
    await updateProactive(env, phone, false)
    body =
      'Alles klar, ich pausiere die morgendlichen Grüße. Mit START kannst du sie jederzeit wieder aktivieren.'
  } else if (command === 'start') {
    await updateProactive(env, phone, true)
    body = 'Sehr gern — die morgendlichen Grüße sind wieder eingeschaltet. ❤️'
  } else if (command === 'help') {
    body = helpText(user.name)
  } else {
    const history = await recentMessages(env, phone)
    const result = await generateReply(env, text, user.name, history)
    body = `${safetyPrefix(text)}${result.text}`
  }
  await deliverNewOutbox(env, phone, body, 'reply', `reply:${messageId}`)
  await markInboundProcessed(env, messageId)
}

export async function deliverNewOutbox(
  env: Env,
  phone: string,
  body: string,
  kind: 'reply' | 'morning',
  dedupeKey: string
): Promise<void> {
  const id = await enqueueOutbox(env, phone, body, kind, dedupeKey)
  await env.INBOUND_QUEUE.send({ kind: 'outbox', messageId: dedupeKey, phone, outboxId: id })
}

export async function deliverOutbox(env: Env, id: number): Promise<void> {
  const claimed = await claimOutbox(env, id)
  if (!claimed) return
  try {
    const providerId = await sendWhatsAppText(env, claimed.phone, claimed.body)
    await markOutboxSent(env, claimed.id, providerId, claimed.phone, claimed.body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown WhatsApp error'
    await markOutboxFailed(env, claimed.id, message)
    throw error
  }
}

export async function processOutbox(env: Env, id: number): Promise<void> {
  await deliverOutbox(env, id)
}

export async function recipientIsConfigured(env: Env, phone: string): Promise<boolean> {
  const configured = env.MOTHER_PHONE?.replace(/^\+/, '').trim()
  return Boolean(configured) && phone.replace(/^\+/, '') === configured
}
