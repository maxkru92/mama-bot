export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export interface CircuitBreakerOptions {
  maxFailures?: number;
  timeout?: number;
  halfOpenMaxCalls?: number;
}

export interface CircuitBreakerStats {
  successes: number;
  failures: number;
  timeouts: number;
  requests: number;
}

export interface CircuitBreakerStateSnapshot {
  state: CircuitState;
  failureCount: number;
  stats: CircuitBreakerStats;
}

export class CircuitBreakerError extends Error {
  public breakerName?: string;
  public state?: string;

  constructor(message: string, breakerName?: string, state?: string) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.breakerName = breakerName;
    this.state = state;
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttemptTime = 0;
  
  public stats: CircuitBreakerStats = {
    successes: 0,
    failures: 0,
    timeouts: 0,
    requests: 0,
  };

  private maxFailures: number;
  private timeout: number;
  private halfOpenMaxCalls: number;
  private halfOpenCalls = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.maxFailures = options.maxFailures ?? 3;
    this.timeout = options.timeout ?? 60000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 2;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState();
    this.stats.requests++;

    if (this.state === 'OPEN') {
      this.stats.timeouts++;
      throw new CircuitBreakerError('Circuit breaker is OPEN. Request blocked.');
    }

    if (this.state === 'HALF-OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private updateState(): void {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF-OPEN';
      this.halfOpenCalls = 0;
    }
  }

  private onSuccess(): void {
    this.stats.successes++;
    
    if (this.state === 'HALF-OPEN') {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.halfOpenCalls = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.stats.failures++;
    this.failureCount++;
    
    if (this.state === 'HALF-OPEN' || this.failureCount >= this.maxFailures) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeout;
    }
  }

  public isClosed(): boolean {
    this.updateState();
    return this.state === 'CLOSED';
  }

  public isOpen(): boolean {
    this.updateState();
    return this.state === 'OPEN';
  }

  public isHalfOpen(): boolean {
    this.updateState();
    return this.state === 'HALF-OPEN';
  }

  public getState(): CircuitBreakerStateSnapshot {
    this.updateState();
    return {
      state: this.state,
      failureCount: this.failureCount,
      stats: { ...this.stats }
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    this.halfOpenCalls = 0;
    this.stats = {
      successes: 0,
      failures: 0,
      timeouts: 0,
      requests: 0,
    };
  }
}

export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
  }

  getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  unregister(name: string): boolean {
    return this.breakers.delete(name);
  }

  clear(): void {
    this.breakers.clear();
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  getStats(): Record<string, { stats: CircuitBreakerStats }> {
    const allStats: Record<string, { stats: CircuitBreakerStats }> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      allStats[name] = { stats: { ...breaker.stats } };
    }
    return allStats;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

export function createCircuitBreaker(nameOrOptions: string | CircuitBreakerOptions, options?: CircuitBreakerOptions): CircuitBreaker {
  if (typeof nameOrOptions === 'string') {
    const breaker = new CircuitBreaker(options || {});
    circuitBreakerRegistry.register(nameOrOptions, breaker);
    return breaker;
  } else {
    const generatedName = `breaker-${crypto.randomUUID()}`;
    const breaker = new CircuitBreaker(nameOrOptions);
    circuitBreakerRegistry.register(generatedName, breaker);
    return breaker;
  }
}

export function createAiProviderCircuitBreaker(options: CircuitBreakerOptions = {}) {
  return createCircuitBreaker('ai-provider', options);
}

export function createQueueCircuitBreaker(options: CircuitBreakerOptions = {}) {
  return createCircuitBreaker('queue-operations', options);
}

export function createSignatureVerificationCircuitBreaker(options: CircuitBreakerOptions = {}) {
  return createCircuitBreaker('signature-verification', options);
}

export function createDatabaseCircuitBreaker(options: CircuitBreakerOptions = {}) {
  return createCircuitBreaker('database-operations', options);
}

export function validateCircuitBreakerConfig(config: any): boolean {
  if (!config || typeof config !== 'object') return false;
  
  if (config.maxFailures !== undefined && typeof config.maxFailures !== 'number') return false;
  if (config.timeout !== undefined && typeof config.timeout !== 'number') return false;
  if (config.halfOpenMaxCalls !== undefined && typeof config.halfOpenMaxCalls !== 'number') return false;
  
  if (config.maxFailures !== undefined && (config.maxFailures < 1 || config.maxFailures > 100)) return false;
  if (config.timeout !== undefined && (config.timeout < 0 || config.timeout > 3600000)) return false;
  if (config.halfOpenMaxCalls !== undefined && (config.halfOpenMaxCalls < 1 || config.halfOpenMaxCalls > 10)) return false;

  return true;
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  const breaker = circuitBreakerRegistry.get(name);
  if (!breaker) {
    return fn();
  }
  try {
    return await breaker.execute(fn);
  } catch (error) {
    if (fallback) {
      return fallback();
    }
    throw error;
  }
}
