import { createAiProviderCircuitBreaker } from './circuitBreaker'
import { generateGroqCompletion } from './groq'
import type { AiResult } from '../types'

const groqCircuitBreaker = createAiProviderCircuitBreaker()

export async function generateReply(
  env: Env,
  prompt: string,
  motherName: string,
  history: Array<{ direction: string; body?: string; content?: string }>
): Promise<AiResult> {
  const correlationId = crypto.randomUUID()

  if (!env.GROQ_API_KEY) {
    const noKeyError = 'Missing GROQ_API_KEY configuration'
    console.error(
      JSON.stringify({
        event: 'ai.generation_failed',
        timestamp: new Date().toISOString(),
        correlationId,
        message: noKeyError
      })
    )
    throw new Error(noKeyError)
  }

  const baseContext = `Du bist ein warmer, verlässlicher deutscher WhatsApp-Begleiter für eine Mutter namens ${motherName}. Du bist fokussiert auf italienische Küche, die Toskana, Reisen und Alltagsdaten. Antworte herzlich und empathisch.`
  const historyContext = history
    .map((msg) => {
      const sender = msg.direction === 'inbound' ? 'Mama' : 'Du'
      return `${sender}: ${msg.body || msg.content || ''}`
    })
    .join('\n')
  const fullContext = `${baseContext}\n\nBisheriger Gesprächsverlauf:\n${historyContext}`

  try {
    const text = await groqCircuitBreaker.execute(() =>
      generateGroqCompletion({
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_MODEL || 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: fullContext },
          { role: 'user', content: prompt }
        ]
      })
    )
    return { text, provider: 'groq' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error(
      JSON.stringify({
        event: 'ai.generation_failed',
        timestamp: new Date().toISOString(),
        correlationId,
        message,
        circuitState: groqCircuitBreaker.getState()
      })
    )
    throw error
  }
}
