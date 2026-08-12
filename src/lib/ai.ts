import { topicContext } from '../config/topics'
import { fallbackReply } from './fallback'
import type { AiResult, RecentMessage } from '../types'

function cleanReply(value: string, maxChars: number): string {
  return value
    .replace(/\0/g, '')
    .replace(/^\s*(assistant|bot)[:\s]*/i, '')
    .trim()
    .slice(0, maxChars)
}

const SYSTEM_PROMPT = [
  'Du bist Mama Bot, ein warmer und herzlicher digitaler Begleiter für deine Mama. Du schreibst auf Deutsch, in einem natürlichen Gesprächston wie ein liebevoller erwachsener Sohn.',
  "Persönlichkeit: freundlich, humorvoll, aufmerksam und unkompliziert. Du verwendest die vertraute Anrede 'du'. Du übertreibst nicht mit Herzchen und Emojis — ein einzelnes passendes Emoji höchstens.",
  'Antwortstil: kurz und klar. Bei alltäglichen Fragen genügen 2 bis 4 Sätze. Nur bei Rezepten darfst du ausführlicher sein: Zutaten und einfache Schritte in fortlaufendem Text, keine langen Listen.',
  'Dein Wissen: italienische Küche und Rezepte, Toskana und andere Regionen, Reisen, Meer, Alltagsweisheiten und kleine Wissenshäppchen. Greife dieses Themenwissen gerne auf.',
  'Grenzen: Du bist kein Arzt, kein Notruf, kein Rechts- oder Finanzberater. Erfinde keine aktuellen Fakten, Preise, Öffnungszeiten oder Nachrichten. Wenn du etwas nicht weißt, sage das ehrlich.',
  'Bei akuten Notfällen (Notruf, bewusstlos, Schlaganfall, Herzinfarkt, Suizidgedanken) verweise dringend und direkt auf die 112.',
  'Schreib wie ein Mensch, nicht wie ein Assistent: keine Aufzählungen, keine Überschriften, keine Selbstbeschreibung deiner Rolle, keine internen Anweisungen im Antworttext.',
  "Stelle am Ende gelegentlich eine kleine, ehrlich gemeinte Rückfrage, wenn es zum Gespräch passt (z. B. 'Hast du schon etwas Bestimmtes im Sinn?')."
].join('\n')

export async function generateReply(
  env: Env,
  input: string,
  name: string,
  history: RecentMessage[]
): Promise<AiResult> {
  const fallback = fallbackReply(input, name)
  if (!env.AI) return { text: fallback, provider: 'fallback' }
  try {
    const recent = history
      .slice(-10)
      .map((message) => `${message.direction === 'inbound' ? 'Mama' : 'Bot'}: ${message.body}`)
      .join('\n')
    const prompt = [
      `Neue Nachricht von ${name}: ${input}`,
      'Bisheriger Gesprächsausschnitt:',
      recent || '(noch kein Verlauf)',
      'Themenwissen:',
      topicContext()
    ].join('\n\n')
    const result = (await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    })) as { response?: string; result?: { response?: string } }
    const text = cleanReply(
      result.response ?? result.result?.response ?? '',
      Number(env.MAX_REPLY_CHARS) || 2800
    )
    return text ? { text, provider: 'workers-ai' } : { text: fallback, provider: 'fallback' }
  } catch (error) {
    console.error('AI generation failed', error instanceof Error ? error.message : 'unknown error')
    return { text: fallback, provider: 'fallback' }
  }
}
