export const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export interface GroqCompletionOptions {
  apiKey: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  timeoutMs?: number
  fetchFn?: typeof fetch
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: unknown } }>
  error?: { message?: unknown }
}

export async function generateGroqCompletion(options: GroqCompletionOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 15_000
  const fetchFn = options.fetchFn ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(GROQ_API_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: options.model, messages: options.messages }),
      signal: controller.signal
    })
    const rawBody = await response.text()
    let payload: GroqResponse = {}
    try {
      payload = JSON.parse(rawBody) as GroqResponse
    } catch {
      // Keep the provider error below stable even if Groq returns non-JSON text.
    }

    if (!response.ok) {
      const providerMessage =
        typeof payload.error?.message === 'string'
          ? payload.error.message.slice(0, 200)
          : 'unknown error'
      throw new Error(`Groq API request failed (${response.status}): ${providerMessage}`)
    }

    const content = payload.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error('Groq API returned no assistant content')
    }
    return content
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Groq API request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
