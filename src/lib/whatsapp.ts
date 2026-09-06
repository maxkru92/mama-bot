export async function sendWhatsappMessage(
  env: Env,
  recipient: string,
  text: string
): Promise<string> {
  // Kanal-Dispatcher: CHANNEL=callmebot nutzt CallMeBot (kein Meta-Token nötig),
  // Standard ist die offizielle Meta Cloud API.
  const channel = (env.CHANNEL || 'meta').toLowerCase()
  const message = text.slice(0, Number(env.MAX_REPLY_CHARS) || 2800)
  if (channel === 'callmebot') {
    return sendCallMeBot(env, recipient, message)
  }
  return sendMetaText(env, recipient, message)
}

// CallMeBot meldet Fehler (Service down, falscher API-Key, falsche Nummer,
// nicht aktiviert) mit HTTP 200/207 und einem Fehlertext im Body. Nur auf den
// HTTP-Status zu schauen wuerde solche Fehler still als Erfolg verbuchen und
// die Nachricht gaenze verlieren. Daher wird der Body auf bekannte
// Fehlermarker geprueft.
const CALLMEBOT_ERROR_MARKERS = [
  'error',
  'service is down',
  'wrong apikey',
  'apikey is invalid',
  'invalid apikey',
  'not activated',
  'not been activated',
  'is incorrect',
  'invalid format',
  'maintenance',
  'unable to',
  'failed'
]

export function callMeBotBodyHasError(body: string): boolean {
  const normalized = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .toLowerCase()
  return CALLMEBOT_ERROR_MARKERS.some((marker) => normalized.includes(marker))
}

async function sendCallMeBot(env: Env, recipient: string, text: string): Promise<string> {
  if (!env.CALLMEBOT_API_KEY) throw new Error('CALLMEBOT_API_KEY fehlt (CHANNEL=callmebot)')
  // CallMeBot erwartet die Nummer OHNE "+" und ohne Leerzeichen.
  const phone = recipient.replace(/[^\d]/g, '')
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
    `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(env.CALLMEBOT_API_KEY)}`
  const response = await fetch(url)
  const body = await response.text().catch(() => '')
  if (!response.ok || callMeBotBodyHasError(body)) {
    const snippet = body
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
    throw new Error(`CallMeBot send failed (${response.status}): ${snippet || 'empty response'}`)
  }
  // CallMeBot liefert keine message-id; deterministische Pseudo-ID für die Outbox.
  return `callmebot-${Date.now()}`
}

async function sendMetaText(env: Env, recipient: string, text: string): Promise<string> {
  const version = env.WHATSAPP_API_VERSION || 'v23.0'
  const endpoint = `https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: { preview_url: false, body: text }
    })
  })
  const payload = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>
    error?: { message?: string }
  }
  if (!response.ok)
    throw new Error(
      `WhatsApp send failed (${response.status}): ${payload.error?.message ?? 'unknown error'}`
    )
  return payload.messages?.[0]?.id ?? 'unknown'
}
