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
    `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(env.CALLMEBOT_API_KEY)}`
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`CallMeBot send failed (${response.status}): ${body.slice(0, 200)}`)
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
