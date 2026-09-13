import { markInbound, markInboundQueueing, markInboundQueued } from './db'
import { normalizePhone } from './lib/phone'
import { timingSafeEqualString } from './lib/signature'
import type { IncomingMessage } from './types'

export const CALLMEBOT_INTENTS = [
  'italien',
  'toskana',
  'rezept',
  'pflege',
  'rente',
  'anwalt',
  'hilfe',
  'start',
  'stop'
] as const

export type CallMeBotIntent = (typeof CALLMEBOT_INTENTS)[number]

const ALIASES: Record<string, CallMeBotIntent> = {
  italien: 'italien',
  italy: 'italien',
  toskana: 'toskana',
  rezept: 'rezept',
  kochen: 'rezept',
  pflege: 'pflege',
  pflegekasse: 'pflege',
  rente: 'rente',
  renten: 'rente',
  anwalt: 'anwalt',
  recht: 'anwalt',
  hilfe: 'hilfe',
  help: 'hilfe',
  start: 'start',
  stop: 'stop',
  stopp: 'stop'
}

export function resolveCallMeBotIntent(value: string | null): CallMeBotIntent | null {
  if (!value) return null
  return ALIASES[value.trim().toLocaleLowerCase('de-DE')] ?? null
}

export function buildCallMeBotPrompt(intent: CallMeBotIntent): string {
  const prompts: Record<CallMeBotIntent, string> = {
    italien: 'Erzähle Sabine kurz etwas Schönes über Italien und stelle eine passende Rückfrage.',
    toskana: 'Erzähle Sabine kurz etwas über die Toskana und stelle eine passende Rückfrage.',
    rezept: 'Empfehle Sabine ein einfaches italienisches Rezept und frage, worauf sie Appetit hat.',
    pflege:
      'Gib Sabine allgemeine Orientierung zu einer Pflegefrage. Keine Rechtsberatung; nenne bei Bedarf Pflegekasse, Pflegestützpunkt oder Sozialverband und frage nach den fehlenden Eckdaten.',
    rente:
      'Gib Sabine allgemeine Orientierung zu einer Rentenfrage. Keine Rechtsberatung; verweise bei konkreten Ansprüchen oder Fristen an die Deutsche Rentenversicherung und frage nach fehlenden Eckdaten.',
    anwalt:
      'Ordne Sabines rechtliches Anliegen vorsichtig allgemein ein. Keine Rechtsberatung; empfehle bei Fristen oder konkreten Dokumenten einen zugelassenen Anwalt oder eine Beratungsstelle.',
    hilfe:
      'Erkläre Sabine kurz die verfügbaren Themen: Italien, Toskana, Rezept, Pflege, Rente und Recht.',
    start: 'Bestätige Sabine kurz, dass die morgendlichen Grüße wieder eingeschaltet sind.',
    stop: 'Bestätige Sabine kurz, dass die morgendlichen Grüße pausiert sind.'
  }
  return prompts[intent]
}

export async function verifyCallMeBotCallback(
  providedToken: string | null,
  configuredToken: string
): Promise<boolean> {
  if (!providedToken || !configuredToken) return false
  return timingSafeEqualString(providedToken, configuredToken)
}

export interface CallMeBotAction {
  intent: CallMeBotIntent
  phone: string
  messageId: string
}

export async function parseCallMeBotAction(
  request: Request,
  configuredToken: string,
  configuredPhone: string
): Promise<CallMeBotAction | null> {
  const url = new URL(request.url)
  if (!(await verifyCallMeBotCallback(url.searchParams.get('token'), configuredToken))) return null
  const intent = resolveCallMeBotIntent(
    url.searchParams.get('intent') ?? url.searchParams.get('query')
  )
  const rawPhone =
    url.searchParams.get('phone') ?? url.searchParams.get('from') ?? url.searchParams.get('sender')
  const phone = normalizePhone(rawPhone || configuredPhone)
  if (!intent || !phone || phone !== normalizePhone(configuredPhone)) return null
  const suppliedId = url.searchParams.get('messageId') ?? url.searchParams.get('id')
  const messageId = suppliedId?.trim() || `callmebot:${intent}:${Math.floor(Date.now() / 60_000)}`
  return { intent, phone, messageId }
}

export async function handleCallMeBotAction(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
  if (!env.CALLMEBOT_CALLBACK_TOKEN) {
    return new Response('CallMeBot callback is not configured', { status: 503 })
  }
  const action = await parseCallMeBotAction(request, env.CALLMEBOT_CALLBACK_TOKEN, env.MOTHER_PHONE)
  if (!action) return new Response('Forbidden', { status: 403 })

  const incoming: IncomingMessage = {
    id: action.messageId,
    phone: action.phone,
    text: action.intent,
    timestamp: new Date().toISOString()
  }
  if (!(await markInbound(env, incoming))) return new Response('EVENT_RECEIVED', { status: 200 })

  try {
    await env.INBOUND_QUEUE.send({
      kind: 'callmebot',
      messageId: action.messageId,
      phone: action.phone,
      text: action.intent,
      intent: action.intent
    })
    await markInboundQueued(env, action.messageId)
    return new Response('EVENT_RECEIVED', { status: 200 })
  } catch (error) {
    await markInboundQueueing(env, action.messageId)
    console.error(
      JSON.stringify({
        event: 'callmebot.publish_failed',
        intent: action.intent,
        error: error instanceof Error ? error.message : 'unknown error'
      })
    )
    return new Response('Queue unavailable', { status: 503 })
  }
}
