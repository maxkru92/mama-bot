export interface LocalTime {
  dateKey: string
  hour: number
  minute: number
}

export function localTime(date: Date, timezone: string): LocalTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '0'
  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    minute: Number(value('minute'))
  }
}

export function withinLastHours(iso: string | null, hours: number, now = Date.now()): boolean {
  if (!iso) return false
  const timestamp = Date.parse(iso)
  return (
    Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp <= hours * 60 * 60 * 1000
  )
}

/** Deterministic 32-bit string hash (stable across runs and regions). */
export function hashString(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0
  }
  return result
}

/**
 * Per-day, deterministic offset in minutes so the morning message
 * does not always arrive at the exact same minute. The offset is
 * stable for a given date and varies between -variance and +variance.
 * Non-finite, negative or fractional variance is clamped to a whole
 * number between 0 and 30.
 */
export function morningOffsetMinutes(dateKey: string, varianceMinutes: number): number {
  const variance = Math.floor(
    Math.max(0, Math.min(30, Number.isFinite(varianceMinutes) ? varianceMinutes : 0))
  )
  const spread = variance * 2 + 1
  const raw = hashString(`offset:${dateKey}`)
  return (Math.abs(raw) % spread) - variance
}
