import { describe, expect, it } from 'vitest'
import { localTime, morningOffsetMinutes, withinLastHours } from '../src/lib/time'

describe('time helpers', () => {
  it('formats Europe/Berlin local time', () => {
    const result = localTime(new Date('2026-01-15T07:00:00.000Z'), 'Europe/Berlin')
    expect(result.dateKey).toBe('2026-01-15')
    expect(result.hour).toBe(8)
  })

  it('checks the 24-hour service window', () => {
    const now = Date.parse('2026-01-02T12:00:00.000Z')
    expect(withinLastHours('2026-01-02T11:00:00.000Z', 24, now)).toBe(true)
    expect(withinLastHours('2025-12-31T11:00:00.000Z', 24, now)).toBe(false)
  })

  it('computes a deterministic per-day morning offset within the variance', () => {
    expect(morningOffsetMinutes('2026-08-12', 0)).toBe(0)
    const offsets = Array.from({ length: 100 }, (_, index) => {
      const dateKey = `2026-08-${String((index % 28) + 1).padStart(2, '0')}`
      return morningOffsetMinutes(dateKey, 10)
    })
    expect(offsets.every((offset) => offset >= -10 && offset <= 10)).toBe(true)
    expect(offsets.some((offset) => offset !== 0)).toBe(true)
    expect(morningOffsetMinutes('2026-08-12', 10)).toBe(morningOffsetMinutes('2026-08-12', 10))
    expect(morningOffsetMinutes('2026-08-12', 10)).not.toBe(morningOffsetMinutes('2026-08-13', 10))
  })

  it('clamps invalid, negative and fractional variance to whole numbers', () => {
    expect(morningOffsetMinutes('2026-08-12', NaN)).toBe(0)
    expect(morningOffsetMinutes('2026-08-12', -5)).toBe(0)
    expect(morningOffsetMinutes('2026-08-12', Infinity)).toBe(0)
    const huge = morningOffsetMinutes('2026-08-12', 999)
    expect(Number.isInteger(huge)).toBe(true)
    expect(Math.abs(huge)).toBeLessThanOrEqual(30)
    const fractional = morningOffsetMinutes('2026-08-12', 2.5)
    expect(Number.isInteger(fractional)).toBe(true)
    expect(Math.abs(fractional)).toBeLessThanOrEqual(2)
  })
})
