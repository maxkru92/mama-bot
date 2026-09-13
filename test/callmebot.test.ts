import { describe, expect, it } from 'vitest'
import {
  buildCallMeBotPrompt,
  parseCallMeBotAction,
  resolveCallMeBotIntent,
  verifyCallMeBotCallback
} from '../src/callmebot'

describe('CallMeBot query bridge', () => {
  it('maps supported queries and aliases to bounded prompts', () => {
    expect(resolveCallMeBotIntent('italien')).toBe('italien')
    expect(resolveCallMeBotIntent('TOSKANA')).toBe('toskana')
    expect(resolveCallMeBotIntent('rente')).toBe('rente')
    expect(resolveCallMeBotIntent('unbekannt')).toBeNull()
    expect(buildCallMeBotPrompt('pflege')).toContain('Pflege')
    expect(buildCallMeBotPrompt('anwalt')).toContain('rechtliche')
  })

  it('accepts only a matching callback token', async () => {
    await expect(verifyCallMeBotCallback('callback-secret', 'callback-secret')).resolves.toBe(true)
    await expect(verifyCallMeBotCallback('wrong', 'callback-secret')).resolves.toBe(false)
    await expect(verifyCallMeBotCallback('', 'callback-secret')).resolves.toBe(false)
  })

  it('parses a query action and normalizes the sender number', async () => {
    const action = await parseCallMeBotAction(
      new Request(
        'https://example.com/callmebot/inbound?query=pflege&phone=%2B49%20160%2090764166&token=callback-secret&id=cb-1'
      ),
      'callback-secret',
      '004916090764166'
    )

    expect(action).toEqual({
      intent: 'pflege',
      phone: '4916090764166',
      messageId: 'cb-1'
    })
  })

  it('rejects an unknown intent or non-allowlisted phone', async () => {
    const unknownIntent = await parseCallMeBotAction(
      new Request('https://example.com/callmebot/inbound?intent=free-text&token=secret'),
      'secret',
      '4916090764166'
    )
    const wrongPhone = await parseCallMeBotAction(
      new Request(
        'https://example.com/callmebot/inbound?intent=hilfe&phone=491701234567&token=secret'
      ),
      'secret',
      '4916090764166'
    )

    expect(unknownIntent).toBeNull()
    expect(wrongPhone).toBeNull()
  })
})
