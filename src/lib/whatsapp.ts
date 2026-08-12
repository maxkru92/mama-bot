export async function sendWhatsAppText(env: Env, recipient: string, text: string): Promise<string> {
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
      text: { preview_url: false, body: text.slice(0, Number(env.MAX_REPLY_CHARS) || 2800) }
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
