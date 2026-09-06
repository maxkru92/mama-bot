import { createAiProviderCircuitBreaker } from './circuitBreaker';
import { AiResult } from '../types';

const groqCircuitBreaker = createAiProviderCircuitBreaker();

export async function generateReply(
  env: any,
  prompt: string,
  motherName: string,
  history: any[]
): Promise<AiResult> {
  const correlationId = crypto.randomUUID();
  
  if (!env.GROQ_API_KEY) {
    const noKeyError = 'Missing GROQ_API_KEY configuration';
    console.error(JSON.stringify({
      event: 'ai.generation_failed',
      timestamp: new Date().toISOString(),
      correlationId,
      message: noKeyError
    }));
    throw new Error(noKeyError);
  }

  // Baue den System-Context mit Mamas Namen und dem Chat-Verlauf zusammen
  const baseContext = `Du bist ein warmer, verlässlicher deutscher WhatsApp-Begleiter für eine Mutter namens ${motherName}. Du bist fokussiert auf italienische Küche, die Toskana, Reisen und Alltagsdaten. Antworte herzlich und empathisch.`;
  
  // Transformiere den Verlauf in ein lesbares Format für das Modell
  const historyContext = history.map((msg: any) => {
    const sender = msg.direction === 'inbound' ? 'Mama' : 'Du';
    return `${sender}: ${msg.body || msg.content || ''}`;
  }).join('\n');

  const fullContext = `${baseContext}\n\nBisheriger Gesprächsverlauf:\n${historyContext}`;

  try {
    return await groqCircuitBreaker.execute(async () => {
      // Wichtig: Offizieller Groq API-Endpunkt, damit die HTTP-Requests ankommen
      const response = await fetch('https://groq.com', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL || 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: fullContext },
            { role: 'user', content: prompt }
          ]
        }),
      });

      if (!response.ok) {
        console.error(JSON.stringify({
          event: 'ai.groq_http_error',
          timestamp: new Date().toISOString(),
          correlationId,
          status: response.status,
          statusText: response.statusText
        }));
        throw new Error(`Groq HTTP failure: ${response.status}`);
      }

      const data: any = await response.json();
      return {
        text: data.choices[0].message.content,
        provider: 'groq'
      };
    });
  } catch (error: any) {
    console.error(JSON.stringify({
      event: 'ai.generation_failed',
      timestamp: new Date().toISOString(),
      correlationId,
      message: 'Groq API core failure. No fallback configured.',
      error: error.message,
      circuitState: groqCircuitBreaker.getState()
    }));
    throw error;
  }
}
