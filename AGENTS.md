# Mama Bot — Agenten-Entwicklung

Dieses Dokument richtet sich an KI-Agenten (Codebuff, Kilo, Cursor etc.), die in diesem Repository arbeiten.

## Projekt-Layout

- `src/index.ts` — Cloudflare Worker Entry (fetch / scheduled / queue)
- `src/webhook.ts` — Meta WhatsApp-Webhook + outbound Dispatch
- `src/processor.ts` — Inbound/Outbound-Verarbeitung, Commands
- `src/lib/ai.ts` — KI-Antwortgenerierung (Groq → Workers AI → Fallback)
- `src/lib/whatsapp.ts` — Sende-Logik (Meta Cloud API + CallMeBot)
- `src/lib/commands.ts` — Kommandoparsing (/start, /stop, /mute etc.)
- `src/lib/signature.ts` — Meta-Signatur-Verifikation
- `src/lib/fallback.ts` — Fallback-Antworten
- `src/lib/time.ts` — Zeit/Schedule-Helper
- `src/config/env.ts` — Required Secrets + Status
- `src/config/topics.ts` — Themenwissen (italienische Küche, Reisen etc.)
- `src/db.ts` — D1-Datenbank (User, Inbound, Outbox, Morning)
- `src/types.ts` — TypeScript-Typen (Env, AiResult, QueueMessage etc.)
- `worker-configuration.d.ts` — Env-Secret-Typen für Wrangler

## Konfiguration (wrangler.toml)

WICHTIG: Alle Konfiguration erfolgt über `wrangler.toml` `[vars]`. Secrets werden _nicht_ für Konfigurationswerte verwendet.

- `MOTHER_NAME` — Name der Begleiterin (Default: Sabine)
- `MOTHER_TIMEZONE`, `MOTHER_LOCALE` — Zeitzone/-locale für Morgen-Gruess
- `MORNING_HOUR`, `MORNING_MINUTE`, `MORNING_VARIANCE_MINUTES` — Morgen-Gruess Scheduling
- `MORNING_DAILY` — `"true"`/`"false"`; deaktiviert täglichen Morgen-Gruess wenn `"false"`
- `AI_MODEL` — Workers AI Modell (nur genutzt wenn `AI_PROVIDER != "groq"`)
- `AI_PROVIDER` — `"groq"` | `"workers-ai"` (Default: workers-ai)
- `GROQ_MODEL` — Groq Modell-Identifikator (Default: qwen/qwen3.8-27b)
- `CHANNEL` — `"meta"` (Default, Meta Cloud API) oder `"callmebot"` (CallMeBot)
- `WHATSAPP_API_VERSION` — Meta API Version (Default: v23.0)
- `MAX_REPLY_CHARS` — Max. Antwortlänge (Default: 2800)

Secrets (werden via `wrangler secret put` gesetzt):

- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, `MOTHER_PHONE`, `GROQ_API_KEY`, `CALLMEBOT_API_KEY`

## Secrets setzen

```bash
cp secrets.env.example secrets.env
# secrets.env mit echten Werten fuellen (LEER useState bei lokaler Entwicklung!)
./deploy.sh secrets     # setzt alle Secrets im Cloudflare Worker
./deploy.sh --no-check  # Deployment ohne Typecheck/Tests (nur zur Not)
```

## Lokale Entwicklung

```bash
npm install
npm run typecheck     # tsc --noEmit
npm test               # Vitest-Tests (webhook, signature, commands, time)
npx wrangler dev       # Lokaler Cloudflare Dev-Server (miniflare)
```

Lokaler Test-Server erfordert `secrets.env` mit mindestens leeren Werten für die env-Vars.

## Deploy

```bash
./deploy.sh              # Full-Deployment mit Checks
./deploy.sh production   # Deploy auf Produktions-Queue (wenn konfiguriert)
```

## Architektur-Entscheidungen

- **Provider-Kette**: Bei `AI_PROVIDER=groq` wird zuerst Groq API (`callGroq`) aufgerufen. Bei Fehler oder wenn kein `GROQ_API_KEY` gesetzt ist, fall back auf Cloudflare Workers AI (`env.AI.run`). Final Fallback auf regelbasierten Fallback-Reply.
- **Kanal-Dispatch**: `sendWhatsappMessage` dispatcht basierend auf `CHANNEL` auf CallMeBot (einfach, gratis, keine Meta-Token nötig) oder Meta Cloud API.
- **Message-Id**: CallMeBot liefert keine echte Message-Id; es wird eine deterministische Pseudo-Id `callmebot-{timestamp}` verwendet für Outbox-Tracking.
- **Rechtlicher Hinweis**: System-Prompt enthält explizite Hinweise zu Notfallsituationen (112, 110, Giftnotruf 030 19240) und rechtlichen Grenzen (keine Beratung).
- **MORNING_DAILY**: Täglicher Morgen-Gruess kann mit `MORNING_DAILY=false` deaktiviert werden, ohne den Scheduler zu deaktivieren.

## Änderungen vornehmen

1. Code ändern
2. `npm run typecheck` lokal bestehen lassen
3. `npm test` lokal bestehen lassen
4. Push — CI prüft Typecheck + Tests automatisch

## Code-Stil

- TypeScript, strict mode
- Keine zusätzlichen Dependencies ohne Notwendigkeit
- Kleine, fokussierte Commits mit beschreibenden Messages
- Secrets niemals im Repo committen (nur `secrets.env.example` mit leeren Werten)
