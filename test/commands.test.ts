import { describe, expect, it } from 'vitest'
import { commandFor, helpText, safetyPrefix } from '../src/lib/commands'

describe('user commands', () => {
  it('recognizes pause and resume commands', () => {
    expect(commandFor('STOPP')).toBe('stop')
    expect(commandFor('  start ')).toBe('start')
    expect(commandFor('Menü')).toBe('help')
    expect(commandFor('Erzähl mir etwas über die Toskana')).toBeNull()
  })

  it('adds an emergency instruction without pretending to provide emergency care', () => {
    expect(safetyPrefix('Ich glaube, das ist ein Notfall')).toContain('112')
    expect(safetyPrefix('Was gibt es heute zu kochen?')).toBe('')
    expect(helpText('Mama')).toContain('STOPP')
  })
})
