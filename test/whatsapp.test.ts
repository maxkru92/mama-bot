import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendWhatsappMessage } from '../src/lib/whatsapp'
import { callMeBotBodyHasError } from '../src/lib/whatsapp'

const baseEnv = {
  CHANNEL: 'callmebot',
  CALLMEBOT_API_KEY: 'test-key',
  MOTHER_PHONE: '4916090764166',
  MAX_REPLY_CHARS: '2800'
} as unknown as Env

beforeEach(() => {
  vi.unstubAllGlobals?.()
  // Clear any previous fetch mocks
  // Note: vi.mockedFetch is deprecated in Vitest v4, use manual mocking instead
})

afterEach(() => {
  vi.unstubAllGlobals?.()
})

describe('CallMeBot response handling', () => {
  it('detects error markers in the HTML body', () => {
    expect(
      callMeBotBodyHasError(
        '<p>Message to: +4916090764166<p>Text to send: hi<br><br><br><b>Service is down (410)</b>'
      )
    ).toBe(true)
    expect(
      callMeBotBodyHasError('ERROR: apikey can not be empty or it has an invalid format')
    ).toBe(true)
    expect(callMeBotBodyHasError('<b>APIKey is invalid.</b> Please create a new one')).toBe(true)
  })

  it('treats a success body (Message Sent) as no error', () => {
    expect(
      callMeBotBodyHasError(
        '<p>Message to: +4916090764166<p>Text to send: Guten Morgen<p><b>Message Sent</b>'
      )
    ).toBe(false)
  })

  it('throws when CallMeBot returns HTTP 200/207 with a service-down body', async () => {
    const responseHtml =
      '<p>Message to: +4916090764166<p>Text to send: hi<br><br><br><b>Service is down (410)</b>'
    const response = new Response(responseHtml, {
      status: 207,
      headers: { 'content-type': 'text/html' }
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => response)
    try {
      await expect(sendWhatsappMessage(baseEnv, '4916090764166', 'Guten Morgen')).rejects.toThrow(
        /CallMeBot send failed \(207\).*Service is down/
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('throws on a non-2xx HTTP status', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => new Response('Gateway error', { status: 502 }))
    try {
      await expect(sendWhatsappMessage(baseEnv, '4916090764166', 'hi')).rejects.toThrow(
        /CallMeBot send failed \(502\)/
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns a message ID on successful response', async () => {
    const originalFetch = globalThis.fetch
    const mockResponse = new Response(
      '<p>Message to: +4916090764166<p>Text to send: hi<br><br><br><b>Message Sent</b>',
      { status: 200, headers: { 'content-type': 'text/html' } }
    )
    globalThis.fetch = vi.fn(async () => mockResponse)
    try {
      const messageId = await sendWhatsappMessage(baseEnv, '4916090764166', 'Guten Morgen')
      expect(messageId).toMatch(/^callmebot-\d+$/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
