import { describe, expect, it } from 'vitest'
import { parseMetaMessages, verifyWebhookRequest } from '../src/webhook'
import { normalizePhone } from '../src/lib/phone'

const encoder = new TextEncoder()

async function signatureFor(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  return `sha256=${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

describe('Meta webhook boundary', () => {
  it('normalizes the configured number consistently', () => {
    expect(normalizePhone('004916090764166')).toBe('4916090764166')
    expect(normalizePhone('+49 160 90764166')).toBe('4916090764166')
  })

  it('accepts a valid signed request and rejects a changed body', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' })
    const signature = await signatureFor(body, 'secret')
    const request = new Request('https://example.test/webhook', {
      method: 'POST',
      body,
      headers: { 'x-hub-signature-256': signature }
    })

    await expect(verifyWebhookRequest(request, 'secret')).resolves.toBe(true)
    const changedRequest = new Request('https://example.test/webhook', {
      method: 'POST',
      body: `${body} `,
      headers: { 'x-hub-signature-256': signature }
    })
    await expect(verifyWebhookRequest(changedRequest, 'secret')).resolves.toBe(false)
  })

  it('extracts only complete text messages from Meta payloads', () => {
    const messages = parseMetaMessages({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    id: 'msg-1',
                    from: '004916090764166',
                    timestamp: '1735689600',
                    type: 'text',
                    text: { body: 'Hallo' }
                  },
                  {
                    id: 'ignored',
                    from: '4916090764166',
                    timestamp: '1735689600',
                    type: 'image'
                  }
                ]
              }
            }
          ]
        }
      ]
    })

    expect(messages).toEqual([
      {
        id: 'msg-1',
        phone: '4916090764166',
        text: 'Hallo',
        timestamp: '2025-01-01T00:00:00.000Z'
      }
    ])
  })
})
