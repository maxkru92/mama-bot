import { MORNING_MESSAGES } from './config/topics'
import { dueOutbox, enqueueOutbox, ensureUser, getState, setState } from './db'
import { hashString, localTime, morningOffsetMinutes, withinLastHours } from './lib/time'

export async function runScheduled(env: Env, now = new Date()): Promise<void> {
  for (const due of await dueOutbox(env, 10)) {
    try {
      await env.INBOUND_QUEUE.send({
        kind: 'outbox',
        messageId: `outbox:${due.id}`,
        phone: env.MOTHER_PHONE,
        outboxId: due.id
      })
      await touchOutbox(env, due.id)
    } catch (error) {
      console.error(
        'outbox queue publish failed',
        error instanceof Error ? error.message : 'unknown error'
      )
    }
  }

  const user = await ensureUser(env, env.MOTHER_PHONE)
  if (!user.proactiveEnabled) return
  const morningDaily = env.MORNING_DAILY === 'true'
  if (!morningDaily && !withinLastHours(user.lastInboundAt, 24, now.getTime())) return

  const clock = localTime(now, user.timezone)
  const hour = Number(env.MORNING_HOUR || 8)
  const minute = Number(env.MORNING_MINUTE || 0)
  const targetMinutes =
    hour * 60 +
    minute +
    morningOffsetMinutes(clock.dateKey, Number(env.MORNING_VARIANCE_MINUTES || 10))
  const currentMinutes = clock.hour * 60 + clock.minute
  const minutesAfterTarget = currentMinutes - targetMinutes
  if (minutesAfterTarget < 0 || minutesAfterTarget > 10) return

  const stateKey = `morning:${clock.dateKey}`
  if (await getState(env, stateKey)) return
  const index = Math.abs(hashString(clock.dateKey)) % MORNING_MESSAGES.length
  const message = MORNING_MESSAGES[index]
  const outboxId = await enqueueOutbox(env, user.phone, message.text, 'morning', stateKey)

  try {
    await env.INBOUND_QUEUE.send({
      kind: 'outbox',
      messageId: stateKey,
      phone: user.phone,
      outboxId
    })
    await setState(env, stateKey, 'queued')
    await touchOutbox(env, outboxId)
  } catch (error) {
    await setState(env, stateKey, 'failed')
    console.error(
      'morning queue publish failed',
      error instanceof Error ? error.message : 'unknown error'
    )
  }
}

async function touchOutbox(env: Env, id: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE outbox SET next_attempt_at = datetime('now', '+1 minute')
     WHERE id = ? AND status IN ('pending', 'failed')`
  )
    .bind(id)
    .run()
}
