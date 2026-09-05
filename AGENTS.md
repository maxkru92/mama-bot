# AGENTS.md — mama-bot

> **Operating mode for this repo.** Read this before touching anything. The
> bot runs on Cloudflare Free Tier (D1 + Queue + Workers AI + Cron) with zero
> runtime cost; do not "improve" it by adding paid services, servers, or
> background daemons. Everything is in **one TypeScript Worker** at `src/`.

---

## 1. Project shape (load-bearing)

- **Entry:** `src/index.ts` exports `{ fetch, scheduled, queue }` — single Worker.
  - `fetch` → `/health`, `/health/config`, `/webhook` (also `/api/whatsapp`)
  - `scheduled` → cron `*/5 * * * *` → `runScheduled()`
  - `queue` → `INBOUND_QUEUE` (`mama-bot-inbound`) → `processInbound` / `processOutbox`
- **Real entrypoints:** `src/webhook.ts`, `src/scheduler.ts`, `src/processor.ts`.
  Everything else (`src/db.ts`, `src/lib/*`, `src/config/*`) is support.
- **Persistence:** Cloudflare D1 (`DB` binding) — see `migrations/0001_initial.sql`.
- **Async:** Cloudflare Queue (`INBOUND_QUEUE`) — `max_batch_size=5`,
  `max_retries=5`, `max_batch_timeout=5`. Same queue is reused for both
  inbound processing and outbox delivery (different `kind` discriminator in
  `QueueMessage`).
- **AI:** Workers AI binding `AI`, model `AI_MODEL` (default
  `@cf/meta/llama-3.1-8b-instruct-fp8-fast`). **Optional** — `generateReply`
  falls back to `fallbackReply()` when `env.AI` is missing.
- **Types / env:** `worker-configuration.d.ts` defines `Env`. Hand-edited, do
  not regenerate.

---

## 2. Non-obvious commands (don't guess)

```bash
npm run check       # CI gate: format:check && typecheck && vitest run
npm run dev         # wrangler dev (local worker)
npm run db:local    # apply migrations to local D1
npm run db:remote   # apply migrations to remote D1
npm run queue:create # npx wrangler queues create mama-bot-inbound
./deploy.sh          # full pipeline: login check → queue → D1 → migrations
                     #   → secrets from secrets.env → check → deploy
./deploy.sh secrets  # only push secrets from secrets.env (interactive via wrangler)
./deploy.sh --no-check  # skip typecheck/tests (use sparingly)
```

- `npm test` runs **Vitest with the `@cloudflare/vitest-pool-workers` pool**,
  not a Node-only runner. Tests need a Worker-compatible runtime; pure Node
  globals (`fs`, `process.env`, etc.) are **not available**.
- Single test: `npx vitest run test/signature.test.ts`. Use the focused
  pattern, don't `npm test` on every change.
- Migrations are applied **idempotently** by `wrangler d1 migrations apply`;
  editing `0001_initial.sql` after it's been applied is a no-op. New schema
  changes need a new `0002_*.sql` file.

---

## 3. Hard-wired rules (don't break these — see `SECURITY.md`)

- **Allowlist is the whole security model.** Only `MOTHER_PHONE` is processed.
  `src/processor.ts:72` `recipientIsConfigured()` strips a leading `+` and
  compares. Any change must keep this strict — never fall back to "accept all".
- **HMAC verification is mandatory on POST.** `src/webhook.ts:53` rejects with
  `401 Invalid signature` if `verifyMetaSignature` fails. Never bypass it,
  even in "dev mode". `test/signature.test.ts` covers the matrix.
- **Deduplication is via D1, not in-memory.** `markInbound` (`src/db.ts:52`)
  - `claimInbound` (`src/db.ts:101`) use the `inbound_events` row as a
    per-`whatsapp_id` lease. Meta retries are idempotent because of this — do
    not "simplify" by removing the table.
- **Outbox is at-least-once with bounded retries.** `claimOutbox`
  (`src/db.ts:170`) caps `attempts < 5`, sets `next_attempt_at` to +15 min on
  claim and exponential `MIN(60, 2*(attempts+1))` min on failure, and marks
  `dead_letter` after 5 attempts. `dedupe_key` is `UNIQUE` in SQL
  (`migrations/0001_initial.sql:52`) — **never** remove this constraint.
- **Safety prefixes override AI tone.** `safetyPrefix` in `src/lib/commands.ts`
  prepends a "ruf 112" message for emergency keywords before any AI reply. It
  runs even when the AI model is bypassed. Don't reorder it past `generateReply`.

---

## 4. Workflow conventions

- **One Worker, two surfaces, one queue.** Don't add a second worker, a
  second queue, or a KV/R2/Durable-Object backend without an explicit reason
  in the PR — the free-tier budget is the design constraint.
- **Strings are German.** System prompt (`src/lib/ai.ts:13`), user-facing
  replies, commands (`STOPP`/`START`/`HILFE`), fallback text, and the
  morning greeting pool (`src/config/topics.ts`) are all `de-DE`. New copy
  must match.
- **Commands are normalized in `de-DE`.** `commandFor` uses
  `toLocaleLowerCase('de-DE')` — don't switch to `'de'` or `en-US`, the
  case-folding differs (`ß` handling).
- **Determinism in cron logic.** `morningOffsetMinutes` is a stable hash so
  the morning message varies by date but is identical across runs for the
  same date. Don't replace it with `Math.random()`.
- **Atomic-ish writes.** D1 is single-statement per `prepare()`; multi-table
  updates use `DB.batch([...])` (`src/db.ts:68`, `:196`). Preserve this — do
  not split into sequential awaits.
- **Secrets come from `secrets.env`, never from `.env` files.** `deploy.sh`
  reads `secrets.env` and pushes with `wrangler secret put`. The set is fixed
  in `deploy.sh:88` (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, `MOTHER_PHONE`). Adding a new
  secret means updating this list.

---

## 5. Things that look like bugs but aren't

- `MOTHER_PHONE` has no `+` in storage (`src/processor.ts:73`) — Meta sends
  E.164-without-`+`. Don't "normalize" it back.
- `processor.ts:34` calls `recentMessages(phone)` even for STOP/START — it
  just isn't used. Don't optimize this away; the call is cheap and ordering
  matters for future personalization.
- `generateReply` returns `provider: 'fallback'` when `env.AI` is missing or
  AI throws — not an error. Test/contract consumers should check `provider`,
  not the absence of an exception.
- `claimInbound` re-leases a row that has been `processing` for >15 minutes
  (`src/db.ts:106`). That is the dead-worker recovery — leave the window
  alone unless you measure stalls.
- `extractMessages` silently drops non-text messages (`src/webhook.ts:36`).
  Voice/image/etc. are intentionally ignored — there's no audio pipeline.

---

## 6. Test coverage reality check

Only **four** test files exist: `signature`, `webhook` (verify only),
`commands`, `time`. No tests for `processor`, `scheduler`, `db`, `whatsapp`,
or `ai`. When you change:

- `src/lib/signature.ts` → must update `test/signature.test.ts`
- `src/lib/commands.ts` → must update `test/commands.test.ts`
- `src/lib/time.ts` → must update `test/time.test.ts`
- anything that touches the queue boundary, outbox, or HMAC flow → add a
  test. The CI gate is `npm run check`, not a custom suite.

---

## 7. PR / commit hygiene

- `CONTRIBUTING.md` requires `npm run check` before any PR.
- **Never** commit `secrets.env`, `.dev.vars`, real phone numbers, real
  tokens, or local SQLite files. `.gitignore` covers them — keep it that way.
- Prettier config is `.prettierrc` (default-ish, 2-space, semicolons, double
  quotes). `npm run format` rewrites; `format:check` only validates.

---

## 8. Out of scope here

- Meta approval / 24h-window billing changes — those happen in the Meta
  dashboard, not the code.
- Cloudflare account / billing changes — the worker is intentionally pinned to
  free tier; don't add paid bindings.
- Multi-tenant support — the entire architecture assumes exactly one user
  (Mama) and one phone number.
