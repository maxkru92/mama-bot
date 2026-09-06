import { processInbound, processOutbox } from './processor';

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
  },

  async queue(batch: MessageBatch<any>, env: any, ctx: ExecutionContext): Promise<void> {
    if (batch.queue === 'mama-bot-inbound') {
      for (const msg of batch.messages) {
        const payload = msg.body || {};
        ctx.waitUntil(
          processInbound(
            batch as any, 
            env, 
            payload.text || payload.body || '', 
            payload.phone || env.MOTHER_PHONE
          )
        );
      }
    } else {
      ctx.waitUntil(processOutbox(batch as any, env));
    }
  },

  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/health' || url.pathname === '/health/config') {
      return new Response(JSON.stringify({ 
        ok: true, 
        timestamp: new Date().toISOString(),
        channel: env.CHANNEL || 'callmebot',
        aiProvider: env.AI_PROVIDER || 'groq'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Mama Bot läuft stabil über Cron-Trigger und Queues! 🍝☕', { status: 200 });
  }
};
