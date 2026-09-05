import { topicContext } from '../config/topics'
import type { AiResult, RecentMessage } from '../types'

export async function generateReplyGroq(
  env: Env,
  input: string,
  name: string,
  history: RecentMessage[],
  systemPrompt: string
): Promise<AiResult> {
  const apiKey = env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured')

  const model = env.GROQ_MODEL || 'qwen/qwen3.8-27b'
  const recent = history
    .slice(-10)
    .map((message) => `${message.direction === 'inbound' ? name : 'Bot'}: ${message.body}`)
    .join('\n')
  const prompt = [
    `Neue Nachricht von ${name}: ${input}`,
    'Bisheriger Gesprächsausschnitt:',
    recent || '(noch kein Verlauf)',
    'Themenwissen:',
    topicContext()
  ].join('\n\n')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Groq API failed (${response.status}): ${error}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = payload.choices?.[0]?.message?.content ?? ''
  return { text, provider: 'groq' }
}
