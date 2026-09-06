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
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'outbox.publish_failed',
          outboxId: due.id,
          error: error instanceof Error ? error.message : 'unknown error'
        })
      )
    }
  }

  const user = await ensureUser(env, env.MOTHER_PHONE)
  // CallMeBot hat keinen Webhook → eingehende Nachrichten unmöglich.
  // Daher den 24h-Aktivitätscheck nur bei Meta (interaktiver Kanal) erzwingen.
  const channel = (env.CHANNEL || 'meta').toLowerCase()
  if (
    channel === 'meta' &&
    (!user.proactiveEnabled || !withinLastHours(user.lastInboundAt, 24, now.getTime()))
  )
    return

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
  // MORNING_DAILY=false deaktiviert den taeglichen Morgen-Gruess (Default: an)
  if ((env.MORNING_DAILY || 'true').toLowerCase() === 'false') return

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
  } catch (error) {
    await setState(env, stateKey, 'failed')
    console.error(
      JSON.stringify({
        event: 'morning.publish_failed',
        stateKey,
        error: error instanceof Error ? error.message : 'unknown error'
      })
    )
  }
}
