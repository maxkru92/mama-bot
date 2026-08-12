import { describe, expect, it } from 'vitest'
import { verifyMetaSignature } from '../src/lib/signature'

const encoder = new TextEncoder()

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  return `sha256=${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

describe('Meta webhook signatures', () => {
  it('accepts a valid signature', async () => {
    const body = '{"hello":"world"}'
    expect(
      await verifyMetaSignature(encoder.encode(body).buffer, await sign(body, 'secret'), 'secret')
    ).toBe(true)
  })

  it('rejects a changed body or secret', async () => {
    const signature = await sign('{"hello":"world"}', 'secret')
    expect(
      await verifyMetaSignature(encoder.encode('{"hello":"changed"}').buffer, signature, 'secret')
    ).toBe(false)
    expect(
      await verifyMetaSignature(encoder.encode('{"hello":"world"}').buffer, signature, 'wrong')
    ).toBe(false)
  })

  it('rejects malformed headers', async () => {
    expect(await verifyMetaSignature(encoder.encode('x').buffer, null, 'secret')).toBe(false)
    expect(await verifyMetaSignature(encoder.encode('x').buffer, 'sha256=bad', 'secret')).toBe(
      false
    )
  })
})
