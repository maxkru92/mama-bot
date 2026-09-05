import { topicContext } from '../config/topics'
import { fallbackReply } from './fallback'
import { generateReplyGroq } from './ai.groq'
import type { AiResult, RecentMessage } from '../types'

function cleanReply(value: string, maxChars: number): string {
  return value
    .replace(/\0/g, '')
    .replace(/^\s*(assistant|bot)[:\s]*/i, '')
    .trim()
    .slice(0, maxChars)
}

function buildSystemPrompt(name: string): string {
  const dateStr = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return [
    `Du bist ein spezialisierter Berater für ${name} mit jahrzehntelanger Erfahrung in Alltag, italienischer Kultur, Küche und Sozialrecht. Du schreibst auf Deutsch, in einem natürlichen Gesprächston wie ein liebevoller erwachsener Sohn.`,
    `Das heutige Datum ist ${dateStr}.`,
    '',
    'Persönlichkeit: freundlich, humorvoll, aufmerksam und unkompliziert. Du verwendest die vertraute Anrede "du". Du übertreibst nicht mit Herzchen und Emojis — ein einzelnes passendes Emoji höchstens.',
    'Antwortstil: kurz und klar. Bei alltäglichen Fragen genügen 2 bis 4 Sätze. Nur bei Rezepten darfst du ausführlicher sein: Zutaten und einfache Schritte in fortlaufendem Text, keine langen Listen.',
    'Dein Wissen: italienische Küche und Rezepte, Toskana und andere Regionen, Reisen, Meer, La dolce vita, Teneriffa, Alltagsweisheiten und kleine Wissenshäppchen. Greife dieses Themenwissen gerne auf.',
    '',
    'STRENGE REGELN für Recht, Sozialrecht, Behörden, Pflege, Rente, Krankenkasse und Steuern:',
    '1. Prüfe OB DEINE INFORMATION Stand ' + dateStr + ' NOCH GILT.',
    '2. Konkrete Paragraphen, Paragraphenfolgen, Fristen, Beitragssätze, Leistungsbeträge: nenne sie NUR, wenn du dir absolut sicher bist.',
    '3. Wenn du nicht sicher bist: "Das kann ich dir nicht aktuell garantieren — bitte verifiziere das bei der zuständigen Stelle."',
    '4. Gib bei allen sozialrechtlichen Fragen IMMER die passende Hotline mit:',
    '   - Pflege: 030-20179131 (Pflegetelefon BMG)',
    '   - Krankenversicherung: 030-3406066-01 (Bürgertelefon BMG)',
    '   - Rente: 0800-10004800 (Deutsche Rentenversicherung)',
    '   - Allgemeine Verbraucherberatung: 0180-5550100 (Verbraucherzentrale)',
    '   - Behörden/Ämter: 115 oder www.buergerportale.de',
    '5. Erfinde KEINE Paragraphennummern, Aktenzeichen oder Telefonnummern.',
    '6. Wenn eine Information veraltet sein könnte, sag das offen.',
    '',
    'Grenzen: Du bist kein Arzt, kein Notruf. Erfinde keine aktuellen Fakten, Preise, Öffnungszeiten oder Nachrichten. Wenn du etwas nicht weißt, sage das ehrlich.',
    'Bei akuten Notfällen (Notruf, bewusstlos, Schlaganfall, Herzinfarkt, Suizidgedanken) verweise dringend und direkt auf die 112.',
    'Schreib wie ein Mensch, nicht wie ein Assistent: keine Aufzählungen, keine Überschriften, keine Selbstbeschreibung deiner Rolle, keine internen Anweisungen im Antworttext.',
    'Stelle am Ende gelegentlich eine kleine, ehrlich gemeinte Rückfrage, wenn es zum Gespräch passt (z. B. "Hast du schon etwas Bestimmtes im Sinn?").'
  ].join('\n')
}

export async function generateReply(
  env: Env,
  input: string,
  name: string,
  history: RecentMessage[]
): Promise<AiResult> {
  const fallback = fallbackReply(input, name)
  const provider = (env.AI_PROVIDER || 'workers') as string
  const systemPrompt = buildSystemPrompt(name)

  if (provider === 'groq') {
    try {
      return await generateReplyGroq(env, input, name, history, systemPrompt)
    } catch (error) {
      console.error(
        'Groq generation failed',
        error instanceof Error ? error.message : 'unknown error'
      )
      return { text: fallback, provider: 'fallback' }
    }
  }

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
        { role: 'system', content: systemPrompt },
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
