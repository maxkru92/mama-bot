import type { IncomingMessage, RecentMessage, UserProfile } from './types'

const now = (): string => new Date().toISOString()

export async function ensureUser(env: Env, phone: string): Promise<UserProfile> {
  await env.DB.prepare(
    `INSERT INTO users (phone, display_name, timezone, locale)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(phone) DO NOTHING`
  )
    .bind(
      phone,
      env.MOTHER_NAME || 'Mama',
      env.MOTHER_TIMEZONE || 'Europe/Berlin',
      env.MOTHER_LOCALE || 'de-DE'
    )
    .run()
  return getUser(env, phone)
}

export async function getUser(env: Env, phone: string): Promise<UserProfile> {
  const row = await env.DB.prepare(
    `SELECT phone, display_name AS name, timezone, locale, proactive_enabled, last_inbound_at
     FROM users WHERE phone = ?`
  )
    .bind(phone)
    .first<{
      phone: string
      name: string
      timezone: string
      locale: string
      proactive_enabled: number
      last_inbound_at: string | null
    }>()
  if (!row) throw new Error('User profile not found')
  return {
    phone: row.phone,
    name: row.name,
    timezone: row.timezone,
    locale: row.locale,
    proactiveEnabled: row.proactive_enabled === 1,
    lastInboundAt: row.last_inbound_at
  }
}

export async function updateProactive(env: Env, phone: string, enabled: boolean): Promise<void> {
  await env.DB.prepare('UPDATE users SET proactive_enabled = ?, updated_at = ? WHERE phone = ?')
    .bind(enabled ? 1 : 0, now(), phone)
    .run()
}

export async function markInbound(env: Env, message: IncomingMessage): Promise<boolean> {
  const existing = await env.DB.prepare('SELECT status FROM inbound_events WHERE whatsapp_id = ?')
    .bind(message.id)
    .first<{ status: 'pending' | 'queueing' | 'queued' | 'processing' | 'processed' }>()
  if (
    existing?.status === 'queued' ||
    existing?.status === 'processing' ||
    existing?.status === 'processed'
  )
    return false
  if (existing?.status === 'queueing' || existing?.status === 'pending') return true

  await env.DB.prepare(`INSERT INTO inbound_events (whatsapp_id, status) VALUES (?, 'queueing')`)
    .bind(message.id)
    .run()

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (phone, display_name, timezone, locale)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(phone) DO NOTHING`
    ).bind(
      message.phone,
      env.MOTHER_NAME || 'Mama',
      env.MOTHER_TIMEZONE || 'Europe/Berlin',
      env.MOTHER_LOCALE || 'de-DE'
    ),
    env.DB.prepare(
      `INSERT INTO messages (whatsapp_id, phone, direction, body, status, created_at)
       VALUES (?, ?, 'inbound', ?, 'received', ?)`
    ).bind(message.id, message.phone, message.text, message.timestamp),
    env.DB.prepare('UPDATE users SET last_inbound_at = ?, updated_at = ? WHERE phone = ?').bind(
      message.timestamp,
      now(),
      message.phone
    )
  ])
  return true
}

export async function markInboundQueued(env: Env, messageId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE inbound_events SET status = 'queued', queued_at = ?
     WHERE whatsapp_id = ? AND status = 'queueing'`
  )
    .bind(now(), messageId)
    .run()
}

export async function claimInbound(env: Env, messageId: string): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE inbound_events SET status = 'processing', processing_at = ?
     WHERE whatsapp_id = ? AND (
       status IN ('queueing', 'queued', 'pending') OR
       (status = 'processing' AND processing_at <= datetime('now', '-15 minutes'))
     )
     RETURNING whatsapp_id`
  )
    .bind(now(), messageId)
    .first<{ whatsapp_id: string }>()
  return Boolean(result)
}

export async function markInboundProcessed(env: Env, messageId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE inbound_events SET status = 'processed', processed_at = ? WHERE whatsapp_id = ?`
  )
    .bind(now(), messageId)
    .run()
}

export async function pendingInbound(
  env: Env,
  limit = 25
): Promise<Array<{ whatsapp_id: string; phone: string; body: string }>> {
  const result = await env.DB.prepare(
    `SELECT e.whatsapp_id, m.phone, m.body
     FROM inbound_events e JOIN messages m ON m.whatsapp_id = e.whatsapp_id
     WHERE e.status = 'queueing' ORDER BY e.received_at ASC LIMIT ?`
  )
    .bind(Math.min(Math.max(limit, 1), 50))
    .all<{ whatsapp_id: string; phone: string; body: string }>()
  return result.results
}

export async function recentMessages(
  env: Env,
  phone: string,
  limit = 10
): Promise<RecentMessage[]> {
  const result = await env.DB.prepare(
    `SELECT direction, body, created_at AS createdAt
     FROM messages WHERE phone = ? ORDER BY created_at DESC LIMIT ?`
  )
    .bind(phone, Math.min(Math.max(limit, 1), 30))
    .all<RecentMessage>()
  return result.results.reverse()
}

export async function enqueueOutbox(
  env: Env,
  phone: string,
  body: string,
  kind: 'reply' | 'morning',
  dedupeKey: string
): Promise<number> {
  const result = await env.DB.prepare(
    `INSERT INTO outbox (phone, body, kind, dedupe_key, status)
     VALUES (?, ?, ?, ?, 'pending')
     ON CONFLICT(dedupe_key) DO UPDATE SET body = excluded.body
     RETURNING id`
  )
    .bind(phone, body, kind, dedupeKey)
    .first<{ id: number }>()
  if (!result) throw new Error('Could not create outbox entry')
  return result.id
}

export async function claimOutbox(
  env: Env,
  id: number
): Promise<{ id: number; phone: string; body: string } | null> {
  const result = await env.DB.prepare(
    `UPDATE outbox SET status = 'sending', attempts = attempts + 1,
       next_attempt_at = datetime('now', '+15 minutes')
     WHERE id = ? AND status IN ('pending', 'failed', 'sending') AND next_attempt_at <= CURRENT_TIMESTAMP
     AND attempts < 5
     RETURNING id, phone, body`
  )
    .bind(id)
    .first<{ id: number; phone: string; body: string }>()
  return result ?? null
}

export async function markOutboxSent(
  env: Env,
  id: number,
  whatsappId: string,
  phone: string,
  body: string
): Promise<void> {
  if (!whatsappId || whatsappId === 'unknown')
    throw new Error('WhatsApp response did not contain a message id')
  const timestamp = now()
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE outbox SET status = 'sent', provider_message_id = ?, sent_at = ?, last_error = NULL WHERE id = ?`
    ).bind(whatsappId, timestamp, id),
    env.DB.prepare(
      `INSERT INTO messages (whatsapp_id, phone, direction, body, status, created_at)
       VALUES (?, ?, 'outbound', ?, 'sent', ?)`
    ).bind(whatsappId, phone, body, timestamp),
    env.DB.prepare('UPDATE users SET last_outbound_at = ?, updated_at = ? WHERE phone = ?').bind(
      timestamp,
      timestamp,
      phone
    )
  ])
}

export async function markOutboxFailed(env: Env, id: number, error: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE outbox
     SET status = CASE WHEN attempts >= 5 THEN 'dead_letter' ELSE 'failed' END,
         last_error = ?, next_attempt_at = datetime('now', '+' || MIN(60, 2 * (attempts + 1)) || ' minutes')
     WHERE id = ?`
  )
    .bind(error.slice(0, 500), id)
    .run()
}

export async function touchOutbox(env: Env, id: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE outbox SET next_attempt_at = datetime('now', '+1 minute')
     WHERE id = ? AND status IN ('pending', 'failed')`
  )
    .bind(id)
    .run()
}

export async function dueOutbox(env: Env, limit = 10): Promise<Array<{ id: number }>> {
  const result = await env.DB.prepare(
    `SELECT id FROM outbox WHERE status IN ('pending', 'failed', 'sending') AND next_attempt_at <= CURRENT_TIMESTAMP
     AND attempts < 5 ORDER BY created_at ASC LIMIT ?`
  )
    .bind(Math.min(Math.max(limit, 1), 25))
    .all<{ id: number }>()
  return result.results
}

export async function getState(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT state_value FROM scheduler_state WHERE state_key = ?')
    .bind(key)
    .first<{ state_value: string }>()
  return row?.state_value ?? null
}

export async function setState(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO scheduler_state (state_key, state_value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at`
  )
    .bind(key, value, now())
    .run()
}
