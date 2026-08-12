<div align="center">

# 🤖 Mama Bot

Ein warmer, deutschsprachiger **WhatsApp-Begleiter für Mama** — mit italienischer Küche, Toskana, Reisen, Meer und kleinen Wissenshäppchen.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-FREE-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![D1](https://img.shields.io/badge/D1-Database-yellow?logo=cloudflare)](https://developers.cloudflare.com/d1/)
[![Workers AI](https://img.shields.io/badge/Workers%20AI-Llama%203.1%208B-purple?logo=cloudflare)](https://developers.cloudflare.com/workers-ai/)
[![WhatsApp Cloud API](https://img.shields.io/badge/WhatsApp-Cloud%20API-green?logo=whatsapp)](https://developers.facebook.com/docs/whatsapp/cloud-api)
[![Tests](https://img.shields.io/badge/tests-11%20passing-brightgreen)](https://github.com/maxkru92/mama-bot/actions)
[![Kosten](https://img.shields.io/badge/Kosten-0%E2%82%AC%2FMonat-success)]()

**100 % kostenlos betreibbar** im Cloudflare Free Tier — offizielle Meta WhatsApp Cloud API, keine Green-API, kein WAHA, kein Server.

</div>

---

## 📖 Inhalt

- [Eigenschaften](#eigenschaften)
- [Architektur](#architektur)
- [Nachrichtenfluss](#nachrichtenfluss)
- [Morgen-Gruß](#morgen-gruß)
- [Datenmodell](#datenmodell)
- [Kosten: 0 €/Monat](#kosten-0-eurmonat)
- [Schnellstart](#schnellstart)
- [Meta-Einrichtung](#meta-einrichtung)
- [Projektstruktur](#projektstruktur)
- [Konfiguration](#konfiguration)
- [Entwicklung & Tests](#entwicklung--tests)
- [Sicherheit](#sicherheit)
- [Lizenz](#lizenz)

---

## ✨ Eigenschaften

| | |
|---|---|
| 🔐 | Offizieller **Meta-Webhook** mit Verify-Token und HMAC-SHA256-Signaturprüfung |
| 🗄️ | **D1** (serverless SQLite) für Gespräche, Präferenzen, Einwilligung, Outbox und Audit-Log |
| 📬 | **Cloudflare Queue** für verzögerte Verarbeitung, Retries und Dead-Letter-Steuerung |
| ⏰ | **Cron-Trigger** alle 5 Minuten für Morgen-Gruß und Outbox-Recovery |
| 🧠 | **Workers AI** (Llama 3.1 8B) mit deterministischem Fallback bei KI- oder Quotenfehlern |
| 🔁 | Deduplizierung von Meta-Retries, at-least-once-Zustellung mit begrenzten Retries |
| 👥 | Nummern-Allowlist: **nur Mamas Nummer** wird verarbeitet |
| 🛑 | `STOPP`, `PAUSE` und `START` steuern die proaktiven Nachrichten |
| 🍝 | 14 kuratierte Themen: Italien, Toskana, Meer, Reisen, Rezepte, Wein, Feste & mehr |
| 🎲 | Morgen-Gruß zu einer **leicht variierenden Uhrzeit** (±10 Min, deterministisch pro Tag) |
| 🧪 | 11 Unit-Tests, Typecheck und Prettier — CI via GitHub Actions |

---

## 🏗️ Architektur

```mermaid
flowchart TB
    subgraph Meta["Meta / WhatsApp"]
        MW["WhatsApp Cloud API"]
    end

    subgraph CF["Cloudflare (Free Tier)"]
        direction TB
        W["Worker: mama-bot<br/>(Edge, global)"]
        subgraph D1["D1 Database"]
            U[(users)]
            M[(messages)]
            O[(outbox)]
            S[(scheduler_state)]
        end
        Q["Queue: mama-bot-inbound"]
        AI["Workers AI<br/>Llama 3.1 8B"]
        CRON["Cron: */5 * * * *"]
    end

    MW -- "Webhook (HMAC-SHA256)" --> W
    W -- "Verifizieren + Deduplizieren" --> D1
    W -- "Nachricht" --> Q
    Q -- "KI-Antwort generieren" --> AI
    Q -- "Antwort in Outbox" --> D1
    Q -- "Meta Send API" --> MW
    CRON -- "Morgen-Gruß / Outbox-Recovery" --> W
    CRON -- "Zustand lesen" --> D1
```

**Warum Cloudflare Workers?** Der Bot ist ein einzelner, zustandsloser Worker an der Edge — kein Server, keine Docker-Container, kein Monitoring-Setup. Alles (Datenbank, Queue, Cron, KI) ist in einer Plattform gebündelt und komplett im Free Tier.

---

## 🔄 Nachrichtenfluss

So verarbeitet der Bot eine eingehende WhatsApp-Nachricht:

```mermaid
sequenceDiagram
    autonumber
    actor M as Mama
    participant Meta as WhatsApp Cloud API
    participant W as Worker (webhook)
    participant D as D1
    participant Q as Queue
    participant AI as Workers AI

    M->>Meta: Schickt Nachricht
    Meta->>W: POST /webhook (signiert)
    W->>W: HMAC-SHA256 prüfen
    alt Signatur ungültig
        W-->>Meta: 401
    end
    W->>W: Nummern-Allowlist prüfen
    W->>D: Deduplizierung (inbound_events)
    W->>Q: Nachricht einreihen (sendBatch)
    W-->>Meta: 200 EVENT_RECEIVED
    Q->>W: Batch: processInbound
    W->>D: Claim Inbound + Verlauf laden
    W->>AI: Prompt + Kontext (14 Themen, letzte 10 Nachrichten)
    AI-->>W: Antwort-Text
    W->>D: Antwort in Outbox (dedupe_key)
    W->>Q: Outbox-Job einreihen
    Q->>W: Batch: processOutbox
    W->>Meta: POST /messages (Text)
    Meta-->>M: Zustellung
    W->>D: Status 'sent' + Nachricht speichern
```

---

## ⏰ Morgen-Gruß

Der tägliche Gruß kommt nur, wenn Mamas letzte Nachricht **maximal 24 Stunden** zurückliegt — so bleibt der Versand im kostenlosen Meta-Kundenservicefenster:

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron (*/5 min)
    participant W as Worker (scheduled)
    participant D as D1
    participant Q as Queue
    participant Meta as WhatsApp Cloud API

    Cron->>W: ScheduledEvent
    W->>D: Outbox-Recovery (dueOutbox)
    W->>D: User-Zustand laden (proactive_enabled, last_inbound_at)
    alt Letzte Nachricht > 24h oder STOPP
        W-->>W: Kein Gruß (kostenloser Modus)
    end
    W->>W: Lokale Zeit (Europe/Berlin) + Tages-Offset (±10 Min)
    alt Zeitfenster offen
        W->>D: Zustand prüfen (morning:YYYY-MM-DD)
        W->>D: Gruß in Outbox (dedupe_key = Tageszustand)
        W->>Q: Outbox-Job
        Q->>W: processOutbox
        W->>Meta: POST /messages (Gruß)
        W->>D: Status 'sent'
    end
```

Die Nachricht selbst wird **deterministisch pro Tag** aus 12 kuratierten Grüßen gewählt — variierende Uhrzeit, wechselnde Inhalte, kein Roboter-Gefühl.

---

## 🗄️ Datenmodell

```mermaid
erDiagram
    users ||--o{ messages : "schreibt"
    users ||--o{ outbox : "empfängt"
    users ||--o{ preferences : "hat"
    users ||--o{ inbound_events : "löst aus"

    users {
        text phone PK "Mamas Nummer"
        text display_name "Anrede"
        text timezone "Europe/Berlin"
        integer proactive_enabled "STOPP/START"
        text last_inbound_at "24h-Fenster"
    }

    messages {
        integer id PK
        text whatsapp_id UK "Meta-Message-ID"
        text phone FK
        text direction "inbound | outbound"
        text body "Inhalt"
        text status "received | sent"
    }

    inbound_events {
        text whatsapp_id PK "Deduplizierung"
        text status "pending → processed"
    }

    outbox {
        integer id PK
        text phone FK
        text body "Zu sendender Text"
        text dedupe_key UK "kein Doppelversand"
        text status "pending → dead_letter"
        integer attempts "max. 5"
    }

    preferences {
        text phone FK
        text preference_key PK
        text preference_value "für spätere Personalisierung"
    }

    scheduler_state {
        text state_key PK "morning:YYYY-MM-DD"
        text state_value "queued | failed"
    }
```

---

## 💰 Kosten: 0 €/Monat

```mermaid
pie title Cloudflare Free Tier vs. Bot-Verbrauch (Stand 2026)
    "Workers: 100.000 Req/Tag" : 100
    "D1: 5M Reads + 100k Writes/Tag" : 100
    "Queue: 10.000 Ops/Tag" : 100
    "Workers AI: 10.000 Neuronen/Tag" : 100
    "Cron: kostenlos" : 100
    "Tatsächlicher Verbrauch (~100 Nachrichten/Tag)" : 1
```

| Komponente | Free-Tier | Bot-Verbrauch | Kosten |
|---|---|---|---|
| Workers | 100.000 Requests/Tag | ~100/Tag | **0 €** |
| D1 | 5 GB, 5 M Reads/Tag | winzige Datenmenge | **0 €** |
| Queue | 10.000 Ops/Tag | ~50/Tag | **0 €** |
| Cron-Trigger | unbegrenzt | alle 5 Min | **0 €** |
| Workers AI | 10.000 Neuronen/Tag | ~100 Neuronen/Nachricht | **0 €** |
| WhatsApp (Meta) | Antworten im 24h-Fenster kostenlos | nur im Fenster | **0 €** |

**Zero-Cost-Garantien im Code:**
- Der Bot versendet proaktiv **nur**, wenn Mamas letzte Nachricht ≤ 24 h zurückliegt (kostenloses Meta-Fenster).
- Bei erschöpfter KI-Quote antwortet er mit kuratierten Fallback-Texten statt Kosten zu erzeugen.
- `STOPP` deaktiviert alle proaktiven Nachrichten sofort.
- Kein Server, keine Templates, keine Marketing-Nachrichten.

> Hinweis: Meta plant ab Oktober 2026 eine kleine Gebühr pro Service-Nachricht im 24h-Fenster. Das ist eine Meta-Preisentscheidung, die kein Anbieter umgehen kann — die Cloudflare-Seite bleibt zu 100 % kostenlos.

---

## 🚀 Schnellstart

Voraussetzungen: [Node.js 20+](https://nodejs.org), [Wrangler 4+](https://developers.cloudflare.com/workers/wrangler/), ein kostenloses Cloudflare-Konto und die Meta-Zugangsdaten (siehe [Meta-Einrichtung](#meta-einrichtung)).

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Meta-Zugangsdaten eintragen
cp secrets.env.example secrets.env
# ... secrets.env mit den Werten aus META_SETUP.md füllen

# 3. Einmalig bei Cloudflare einloggen (öffnet Browser)
npx wrangler login

# 4. Secrets setzen
./deploy.sh secrets

# 5. Infrastruktur + Deploy (D1, Queue, Migrationen, Checks, Deploy)
./deploy.sh
```

`deploy.sh` erledigt alles automatisch: Login-Check, Queue-Erstellung, D1-ID, Migrationen, Secrets aus `secrets.env`, Typecheck/Tests und Deployment.

### Manuell (ohne Skript)

```bash
npx wrangler d1 create mama-bot-db        # ID in wrangler.toml eintragen
npx wrangler queues create mama-bot-inbound
npm run db:remote                          # Migrationen
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_VERIFY_TOKEN
npx wrangler secret put META_APP_SECRET
npx wrangler secret put MOTHER_PHONE
npm run check && npm run deploy
```

Danach im Meta-Dashboard als Callback-URL eintragen:

```
https://mama-bot.<dein-subdomain>.workers.dev/webhook
```

---

## 🔑 Meta-Einrichtung

Die komplette Schritt-für-Schritt-Anleitung (App anlegen, Testnummer, permanentes Token, Webhook) steht in **[`META_SETUP.md`](./META_SETUP.md)** — einmalig ~10 Minuten, danach ist alles automatisiert.

---

## 📁 Projektstruktur

```text
mama-bot/
├── src/
│   ├── index.ts              # Worker-Einstieg (fetch, scheduled, queue)
│   ├── webhook.ts            # Meta-Webhook: Verify + HMAC + Deduplizierung
│   ├── processor.ts          # Inbound-Verarbeitung + Outbox-Zustellung
│   ├── scheduler.ts          # Morgen-Gruß + Outbox-Recovery (Cron)
│   ├── db.ts                 # D1-Zugriff (users, messages, outbox, …)
│   ├── types.ts              # Gemeinsame Typen
│   ├── config/
│   │   ├── env.ts            # Pflicht-Secrets-Prüfung
│   │   └── topics.ts         # 14 Themen + 12 Morgen-Grüße
│   └── lib/
│       ├── ai.ts             # Workers AI Prompt + Fallback
│       ├── commands.ts       # STOPP / START / HILFE
│       ├── fallback.ts       # Deterministische Fallback-Antworten
│       ├── signature.ts      # HMAC-SHA256-Verifikation
│       ├── time.ts           # Zeitzonen + Morgen-Varianz
│       └── whatsapp.ts       # Meta Send API Client
├── migrations/
│   └── 0001_initial.sql      # D1-Schema
├── test/                     # 11 Unit-Tests (Vitest)
├── .github/workflows/check.yml  # CI: format + typecheck + tests
├── deploy.sh                 # Vollautomatisches Deployment
├── secrets.env.example       # Template für Meta-Secrets (NIEMALS committen)
├── META_SETUP.md             # Meta-Einrichtungsanleitung
└── wrangler.toml             # Cloudflare-Konfiguration
```

---

## ⚙️ Konfiguration

| Variable | Zweck | Standard |
|---|---|---|
| `MOTHER_PHONE` | Mamas Nummer ohne `+` | — (Pflicht) |
| `WHATSAPP_TOKEN` | Meta Access Token | — (Pflicht) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Phone Number ID | — (Pflicht) |
| `WHATSAPP_VERIFY_TOKEN` | Webhook-Verify-Token | — (Pflicht) |
| `META_APP_SECRET` | App-Secret für HMAC | — (Pflicht) |
| `MOTHER_TIMEZONE` | Zeitzone für Morgen-Gruß | `Europe/Berlin` |
| `MORNING_HOUR` / `MORNING_MINUTE` | Zielzeit des Grußes | `8:00` |
| `MORNING_VARIANCE_MINUTES` | Varianz der Grußzeit | `10` |
| `MOTHER_NAME` | Persönliche Anrede | `Mama` |
| `AI_MODEL` | Workers-AI-Modell | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` |
| `MAX_REPLY_CHARS` | Maximale Antwortlänge | `2800` |

---

## 🧪 Entwicklung & Tests

```bash
npm run dev            # Lokaler Worker (wrangler dev)
npm run typecheck      # TypeScript-Checks
npm test               # 11 Unit-Tests (Vitest)
npm run format:check   # Prettier
npm run check          # Alles zusammen (CI-Stufe)
```

CI läuft automatisch bei jedem Push/PR über **GitHub Actions** (`npm run check`).

---

## 🔒 Sicherheit

- **Secrets niemals committen**: `secrets.env`, `.dev.vars` und `.env` sind gitignored.
- **HMAC-SHA256**: Jeder Webhook-Aufruf wird gegen `META_APP_SECRET` verifiziert.
- **Nummern-Allowlist**: Nur `MOTHER_PHONE` wird verarbeitet.
- **Deduplizierung**: Meta-Retries erzeugen keine Doppelverarbeitung.
- **At-least-once**: Outbox mit max. 5 Versuchen und Dead-Letter-Status.
- **Sicherheitsgrenzen**: Der Bot ist kein Arzt, Notruf oder Rechtsberater; bei Notfällen verweist er auf **112**.
- Details: [`SECURITY.md`](./SECURITY.md)

---

## 📜 Lizenz

MIT — siehe [`LICENSE`](./LICENSE).
