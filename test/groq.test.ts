import { describe, expect, it, vi } from 'vitest'
import { generateGroqCompletion, GROQ_API_ENDPOINT } from '../src/lib/groq'

describe('Groq provider gateway', () => {
  it('posts chat completions to the official API endpoint', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Hallo!' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )

    await expect(
      generateGroqCompletion({
        apiKey: 'test-key',
        model: 'qwen/qwen3.8-27b',
        messages: [{ role: 'user', content: 'Sag Hallo.' }],
        fetchFn
      })
    ).resolves.toBe('Hallo!')

    expect(fetchFn).toHaveBeenCalledWith(
      GROQ_API_ENDPOINT,
      expect.objectContaining({ method: 'POST' })
    )
    expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'qwen/qwen3.8-27b'
    })
  })

  it('rejects provider errors and malformed successful responses', async () => {
    const errorFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'invalid model' } }), { status: 400 })
      )
    await expect(
      generateGroqCompletion({
        apiKey: 'test-key',
        model: 'bad',
        messages: [],
        fetchFn: errorFetch
      })
    ).rejects.toThrow('Groq API request failed (400): invalid model')

    const malformedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 200 }))
    await expect(
      generateGroqCompletion({
        apiKey: 'test-key',
        model: 'qwen/qwen3.8-27b',
        messages: [],
        fetchFn: malformedFetch
      })
    ).rejects.toThrow('Groq API returned no assistant content')
  })
})
