import { describe, expect, it } from 'vitest'
import { metaChannel } from '../src/lib/channel'

describe('Meta webhook verification', () => {
  const env = { WHATSAPP_VERIFY_TOKEN: 'test-token' } as Env

  it('returns the challenge for the correct token', async () => {
    const request = new Request(
      'https://example.com/webhook?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=abc123'
    )
    const response = metaChannel.verifyGet(request, env)
    expect(response?.status).toBe(200)
    expect(await response?.text()).toBe('abc123')
  })

  it('rejects an incorrect token', () => {
    const request = new Request(
      'https://example.com/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123'
    )
    expect(metaChannel.verifyGet(request, env)?.status).toBe(403)
  })
})
