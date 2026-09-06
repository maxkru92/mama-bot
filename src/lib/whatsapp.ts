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

async function sendCallMeBot(env: Env, recipient: string, text: string): Promise<string> {
  if (!env.CALLMEBOT_API_KEY) throw new Error('CALLMEBOT_API_KEY fehlt (CHANNEL=callmebot)')
  // CallMeBot erwartet die Nummer OHNE "+" und ohne Leerzeichen.
  const phone = recipient.replace(/[^\d]/g, '')
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
    `&text=${encodeURIComponent(text)}`
  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': env.CALLMEBOT_API_KEY },
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`CallMeBot send failed (${response.status}): ${body.slice(0, 200)}`)
    }
    // CallMeBot liefert keine message-id; deterministische Pseudo-ID für die Outbox.
    return `callmebot-${Date.now()}`
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('WhatsApp send timeout')
    }
    throw error
  }
}

async function sendMetaText(env: Env, recipient: string, text: string): Promise<string> {
  const version = env.WHATSAPP_API_VERSION || 'v23.0'
  const endpoint = `https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  try {
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
      }),
      signal: AbortSignal.timeout(15_000)
    })
    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>
      error?: { message?: string }
    }
    if (!response.ok)
      throw new Error(
        `WhatsApp send failed (${response.status}): ${payload.error?.message ?? 'unknown error'}`
      )
    const messageId = payload.messages?.[0]?.id
    if (!messageId) {
      console.warn(`WhatsApp send response missing message id`, { recipient })
      return `meta-unknown-${Date.now()}`
    }
    return messageId
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('WhatsApp send timeout')
    }
    throw error
  }
}
