import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  createCircuitBreaker,
  createAiProviderCircuitBreaker,
  createQueueCircuitBreaker,
  createSignatureVerificationCircuitBreaker,
  createDatabaseCircuitBreaker,
  withCircuitBreaker,
  circuitBreakerRegistry,
  validateCircuitBreakerConfig,
  CircuitBreakerError
} from '../src/lib/circuitBreaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({ maxFailures: 3, timeout: 100, halfOpenMaxCalls: 2 })
  })

  it('starts in CLOSED state', () => {
    expect(breaker.isClosed()).toBe(true)
    expect(breaker.isOpen()).toBe(false)
    expect(breaker.isHalfOpen()).toBe(false)
  })

  it('stays CLOSED on success', async () => {
    const result = await breaker.execute(async () => 42)
    expect(result).toBe(42)
    expect(breaker.isClosed()).toBe(true)
    expect(breaker.stats.successes).toBe(1)
    expect(breaker.stats.failures).toBe(0)
  })

  it('stays CLOSED until maxFailures is reached', async () => {
    const fail = async (): Promise<void> => {
      throw new Error('boom')
    }

    await expect(breaker.execute(fail)).rejects.toThrow('boom')
    expect(breaker.isClosed()).toBe(true)
    expect(breaker.stats.failures).toBe(1)

    await expect(breaker.execute(fail)).rejects.toThrow('boom')
    expect(breaker.isClosed()).toBe(true)
    expect(breaker.stats.failures).toBe(2)
  })

  it('opens after maxFailures consecutive failures', async () => {
    const fail = async (): Promise<void> => {
      throw new Error('boom')
    }

    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})

    expect(breaker.isOpen()).toBe(true)
    expect(breaker.stats.failures).toBe(3)
  })

  it('rejects calls immediately when OPEN', async () => {
    const fail = async (): Promise<void> => {
      throw new Error('boom')
    }

    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    expect(breaker.isOpen()).toBe(true)

    await expect(breaker.execute(async () => 'should-not-run')).rejects.toThrow(CircuitBreakerError)
    expect(breaker.stats.timeouts).toBe(1)
  })

  it('transitions to HALF_OPEN after timeout', async () => {
    const fail = async (): Promise<void> => {
      throw new Error('boom')
    }

    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    expect(breaker.isOpen()).toBe(true)

    // Wait for timeout to elapse
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Next call should transition to HALF_OPEN and attempt the operation
    const result = await breaker.execute(async () => 'recovered')
    expect(result).toBe('recovered')
    expect(breaker.isHalfOpen()).toBe(true)
  })

  it('resets to CLOSED after halfOpenMaxCalls successes', async () => {
    const fail = async (): Promise<void> => {
      throw new Error('boom')
    }

    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    expect(breaker.isOpen()).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 150))

    await breaker.execute(async () => 'ok1')
    await breaker.execute(async () => 'ok2')

    expect(breaker.isClosed()).toBe(true)
  })

  it('resets failure count on success while CLOSED', async () => {
    const fail = async (): Promise<void> => {
      throw new Error('boom')
    }

    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    expect(breaker.stats.failures).toBe(2)

    // A success should reset the failure count
    await breaker.execute(async () => 'ok')
    expect(breaker.isClosed()).toBe(true)
    expect(breaker.stats.failures).toBe(2) // stats.cumulative, not current streak

    // Now 2 more failures should not open the breaker (streak was reset)
    await breaker.execute(fail).catch(() => {})
    await breaker.execute(fail).catch(() => {})
    expect(breaker.isOpen()).toBe(false)
  })

  it('reset() returns to CLOSED and clears stats', () => {
    breaker.reset()
    expect(breaker.isClosed()).toBe(true)
    expect(breaker.stats.failures).toBe(0)
    expect(breaker.stats.successes).toBe(0)
    expect(breaker.stats.timeouts).toBe(0)
    expect(breaker.stats.requests).toBe(0)
  })

  it('getState() returns current state and stats', async () => {
    await breaker.execute(async () => 'ok')
    const state = breaker.getState()
    expect(state.state).toBe('CLOSED')
    expect(state.failureCount).toBe(0)
    expect(state.stats.requests).toBe(1)
    expect(state.stats.successes).toBe(1)
  })
})

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry

  beforeEach(() => {
    registry = new CircuitBreakerRegistry()
  })

  it('registers and retrieves breakers', () => {
    const breaker = new CircuitBreaker()
    registry.register('test', breaker)
    expect(registry.get('test')).toBe(breaker)
  })

  it('returns undefined for unknown breaker', () => {
    expect(registry.get('unknown')).toBeUndefined()
  })

  it('getAll returns a copy of all breakers', () => {
    const b1 = new CircuitBreaker()
    const b2 = new CircuitBreaker()
    registry.register('a', b1)
    registry.register('b', b2)
    const all = registry.getAll()
    expect(all.size).toBe(2)
    expect(all.get('a')).toBe(b1)
    expect(all.get('b')).toBe(b2)
  })

  it('resetAll resets all breakers', async () => {
    const b1 = new CircuitBreaker({ maxFailures: 1 })
    const b2 = new CircuitBreaker({ maxFailures: 1 })

    await b1
      .execute(async () => {
        throw new Error('boom')
      })
      .catch(() => {})
    await b2
      .execute(async () => {
        throw new Error('boom')
      })
      .catch(() => {})

    expect(b1.isOpen()).toBe(true)
    expect(b2.isOpen()).toBe(true)

    registry.register('b1', b1)
    registry.register('b2', b2)
    registry.resetAll()

    expect(b1.isClosed()).toBe(true)
    expect(b2.isClosed()).toBe(true)
  })

  it('getStats returns stats for all breakers', async () => {
    const b1 = new CircuitBreaker()
    registry.register('b1', b1)

    await b1.execute(async () => 'ok')
    const stats = registry.getStats()
    expect(stats['b1'].stats.requests).toBe(1)
  })

  it('unregister removes a breaker', () => {
    const breaker = new CircuitBreaker()
    registry.register('test', breaker)
    expect(registry.unregister('test')).toBe(true)
    expect(registry.get('test')).toBeUndefined()
  })
})

describe('Factory functions', () => {
  it('createCircuitBreaker creates a CLOSED breaker', () => {
    const b = createCircuitBreaker({ maxFailures: 5 })
    expect(b.isClosed()).toBe(true)
  })

  it('createAiProviderCircuitBreaker creates with correct config', () => {
    const b = createAiProviderCircuitBreaker()
    expect(b.isClosed()).toBe(true)
  })

  it('createQueueCircuitBreaker creates with correct config', () => {
    const b = createQueueCircuitBreaker()
    expect(b.isClosed()).toBe(true)
  })

  it('createSignatureVerificationCircuitBreaker creates with correct config', () => {
    const b = createSignatureVerificationCircuitBreaker()
    expect(b.isClosed()).toBe(true)
  })

  it('createDatabaseCircuitBreaker creates with correct config', () => {
    const b = createDatabaseCircuitBreaker()
    expect(b.isClosed()).toBe(true)
  })
})

describe('withCircuitBreaker', () => {
  afterEach(() => {
    circuitBreakerRegistry.unregister('withCb-test')
  })

  it('executes operation when breaker is not registered', async () => {
    const result = await withCircuitBreaker('unknown', async () => 'fallback')
    expect(result).toBe('fallback')
  })

  it('executes operation when breaker is CLOSED', async () => {
    const breaker = new CircuitBreaker({ maxFailures: 3 })
    circuitBreakerRegistry.register('withCb-test', breaker)

    const result = await withCircuitBreaker('withCb-test', async () => 42)
    expect(result).toBe(42)
  })

  it('calls fallback when breaker is OPEN', async () => {
    const breaker = new CircuitBreaker({ maxFailures: 1, timeout: 60000 })
    circuitBreakerRegistry.register('withCb-test', breaker)

    const fail = async (): Promise<void> => {
      throw new Error('boom')
    }

    // Open the breaker
    await breaker.execute(fail).catch(() => {})
    expect(breaker.isOpen()).toBe(true)

    const result = await withCircuitBreaker(
      'withCb-test',
      async () => 'primary',
      async () => 'fallback'
    )
    expect(result).toBe('fallback')
  })

  it('throws when breaker is OPEN and no fallback', async () => {
    const breaker = new CircuitBreaker({ maxFailures: 1, timeout: 60000 })
    circuitBreakerRegistry.register('withCb-test', breaker)

    await breaker
      .execute(async () => {
        throw new Error('boom')
      })
      .catch(() => {})

    await expect(withCircuitBreaker('withCb-test', async () => 'primary')).rejects.toThrow(
      CircuitBreakerError
    )
  })
})

describe('validateCircuitBreakerConfig', () => {
  it('accepts valid config', () => {
    expect(validateCircuitBreakerConfig({ maxFailures: 5, timeout: 30000 })).toBe(true)
  })

  it('rejects maxFailures < 1', () => {
    expect(validateCircuitBreakerConfig({ maxFailures: 0 })).toBe(false)
  })

  it('rejects maxFailures > 100', () => {
    expect(validateCircuitBreakerConfig({ maxFailures: 101 })).toBe(false)
  })

  it('rejects negative timeout', () => {
    expect(validateCircuitBreakerConfig({ timeout: -1 })).toBe(false)
  })

  it('rejects timeout > 3600000', () => {
    expect(validateCircuitBreakerConfig({ timeout: 3600001 })).toBe(false)
  })

  it('rejects halfOpenMaxCalls < 1', () => {
    expect(validateCircuitBreakerConfig({ halfOpenMaxCalls: 0 })).toBe(false)
  })

  it('rejects halfOpenMaxCalls > 10', () => {
    expect(validateCircuitBreakerConfig({ halfOpenMaxCalls: 11 })).toBe(false)
  })

  it('accepts empty config', () => {
    expect(validateCircuitBreakerConfig({})).toBe(true)
  })
})

describe('CircuitBreakerError', () => {
  it('creates error with name CircuitBreakerError', () => {
    const error = new CircuitBreakerError('test', 'my-breaker', 'OPEN')
    expect(error.name).toBe('CircuitBreakerError')
    expect(error.message).toBe('test')
    expect(error.breakerName).toBe('my-breaker')
    expect(error.state).toBe('OPEN')
  })

  it('creates error without optional fields', () => {
    const error = new CircuitBreakerError('test')
    expect(error.name).toBe('CircuitBreakerError')
    expect(error.breakerName).toBeUndefined()
    expect(error.state).toBeUndefined()
  })
})
