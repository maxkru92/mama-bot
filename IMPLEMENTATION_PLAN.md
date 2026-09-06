# Mama Bot — Senior Chief Coder Implementation Plan

## Context
This is a comprehensive architectural overhaul for the mama-bot repository, addressing critical error handling, circuit breakers, input validation, observability, and separation of concerns. The system needs to be hardened against production failures while maintaining its core functionality of processing WhatsApp messages, generating AI responses, and sending morning greetings.

## Current State Assessment

### Critical Single Points of Failure (SPOFs)

1. **src/webhook.ts:82-87 - JSON Parsing Without Recovery**
   - Problem: `JSON.parse` throws exception without structured error handling
   - Impact: Invalid JSON crashes the webhook handler
   - Location: `src/webhook.ts:82-87`

2. **src/lib/ai.ts:48-61 - Groq API Provider Chain**
   - Problem: AI provider chain lacks circuit breaker for Groq API calls
   - Impact: Service disruptions cascade through the system
   - Location: `src/lib/ai.ts:48-61`

3. **src/scheduler.ts:11-28 - Queue Batch Operations**
   - Problem: Queue operations without circuit breaker or retry logic
   - Impact: System gets stuck in failed state during queue issues
   - Location: `src/scheduler.ts:11-28`

4. **src/webhook.ts:74-80 - Signature Verification**
   - Problem: HMAC signature verification fails without recovery
   - Impact: Legitimate requests rejected without graceful handling
   - Location: `src/webhook.ts:74-80`

5. **src/db.ts:68-88 - Database Transaction Atomicity**
   - Problem: Complex DB operations lack proper rollback on failure
   - Impact: Partial updates leave system in inconsistent state
   - Location: `src/db.ts:68-88`

### Error Handling Anti-Patterns

- **src/webhook.ts:84-87** - Bare `catch` block
- **src/scheduler.ts:87-95** - Bare `catch` block
- **src/lib/ai.ts:78-86** - Bare `catch` block
- **src/index.ts:57-66** - Bare `catch` block

### Separation of Concerns Violations

- **src/db.ts:68-88** - User creation mixed with message handling (violates Single Responsibility Principle)
- **src/processor.ts:16-42** - Business logic tightly coupled with DB access (violates Separation of Concerns)

## Implementation Plan

### Phase 1: Circuit Breaker Infrastructure

#### Task 1: Implement Circuit Breaker Class
- **Location**: `src/lib/circuitBreaker.ts`
- **Problem**: All provider chains lack circuit breaker protection
- **Solution**: Implement generic circuit breaker with state management
- **Test**: Unit tests for circuit breaker state transitions and recovery

#### Task 2: AI Provider Chain Circuit Breaker
- **Location**: `src/lib/ai.ts:48-61`
- **Problem**: Groq API calls fail without circuit breaker or retry logic
- **Solution**: Integrate circuit breaker into AI provider chain
- **Test**: Integration test simulating API failures and circuit recovery

#### Task 3: Queue Operations Circuit Breaker
- **Location**: `src/scheduler.ts:11-28`
- **Problem**: Queue operations without circuit breaker
- **Solution**: Add circuit breaker to queue operations
- **Test**: Test queue circuit breaker with simulated failures

#### Task 4: Signature Verification Circuit Breaker
- **Location**: `src/webhook.ts:74-80`
- **Problem**: Signature verification failures accumulate without recovery
- **Solution**: Implement circuit breaker for signature verification
- **Test**: Test signature verification circuit breaker behavior

### Phase 2: Error Handling Standardization

#### Task 5: Structured Error Handling for JSON Parsing
- **Location**: `src/webhook.ts:82-87`
- **Problem**: Bare `catch` block without structured error logging
- **Solution**: Implement structured error handling with logging and recovery
- **Test**: Test invalid JSON handling and error logging

#### Task 6: Standardized Error Handling Across All Try-Catch Blocks
- **Location**: All bare `catch` blocks in the codebase
- **Problem**: Multiple inconsistent error handling approaches
- **Solution**: Standardize error handling with structured logging
- **Test**: Integration test for error handling consistency

### Phase 3: Input Validation and Security

#### Task 7: Implement Input Validation Middleware
- **Location**: `src/processor.ts:16-42`
- **Problem**: No validation of message inputs before processing
- **Solution**: Add comprehensive input validation
- **Test**: Unit tests for input validation scenarios

#### Task 8: Security Enhancement for Signature Verification
- **Location**: `src/webhook.ts:75-78`
- **Problem**: Constant-time comparison not properly implemented
- **Solution**: Ensure constant-time comparison for security
- **Test**: Security test for timing attack prevention

### Phase 4: Database Transaction Atomicity

#### Task 9: Implement Database Transaction Wrapper
- **Location**: `src/db.ts:68-88`
- **Problem**: Complex DB operations lack proper rollback
- **Solution**: Wrap DB operations in transactions with rollback support
- **Test**: Test transaction atomicity under failure conditions

### Phase 5: Observability and Monitoring

#### Task 10: Implement Structured Logging
- **Location**: All console.log/console.error calls
- **Problem**: Inconsistent logging format without observability
- **Solution**: Implement structured logging with correlation IDs
- **Test**: Integration test for structured logging

#### Task 11: Add Health Check Endpoints
- **Location**: `src/index.ts`
- **Problem**: No health checks for external dependencies
- **Solution**: Implement comprehensive health checks
- **Test**: Unit tests for health check functionality

### Phase 6: Refactoring for Separation of Concerns

#### Task 12: Separate User Management from Message Handling
- **Location**: `src/db.ts:68-88`
- **Problem**: User creation mixed with message handling
- **Solution**: Extract user management into separate service
- **Test**: Test user management independence

#### Task 13: Separate Business Logic from Data Access
- **Location**: `src/processor.ts:16-42`
- **Problem**: Business logic tightly coupled with DB access
- **Solution**: Implement service layer for business logic
- **Test**: Test business logic independence from data access

## Dependencies and Sequencing

### Implementation Dependencies

1. **Task 1** (Circuit Breaker Class) - MUST be implemented first
2. **Task 5** (JSON Parsing Error Handling) - Depends on Task 1
3. **Task 2** (AI Provider Circuit Breaker) - Depends on Task 1
4. **Task 3** (Queue Circuit Breaker) - Depends on Task 1
5. **Task 4** (Signature Verification Circuit Breaker) - Depends on Task 1
6. **Task 6** (Standardized Error Handling) - Can run in parallel with Tasks 2-4
7. **Task 7** (Input Validation) - Can run in parallel with Task 6
8. **Task 8** (Security Enhancement) - Can run in parallel with Task 7
9. **Task 9** (Database Transactions) - Can run in parallel with Tasks 7-8
10. **Task 10** (Structured Logging) - Can run in parallel with Task 9
11. **Task 11** (Health Checks) - Can run in parallel with Task 10
12. **Task 12** (User Management Separation) - Can run in parallel with Tasks 9-11
13. **Task 13** (Business Logic Separation) - Can run in parallel with Task 12

## Technical Requirements

### Performance Considerations
- Circuit breaker timeouts: 60 seconds after 3 consecutive failures
- Circuit breaker recovery: Half-open state after timeout
- Retry backoff: Exponential backoff for transient failures
- Resource limits: Bounded buffers to prevent memory leaks

### Security Requirements
- All signature verification must use constant-time comparison
- Input validation to prevent injection attacks
- Structured logging without exposing sensitive information
- Circuit breaker state must not leak timing information

### Reliability Requirements
- All database operations must be atomic
- Circuit breakers must protect against cascading failures
- Error handling must not suppress critical information
- Health checks must verify all external dependencies

## Testing Strategy

### Unit Tests
- Circuit breaker state transitions
- JSON parsing error handling
- Input validation scenarios
- Database transaction atomicity

### Integration Tests
- AI provider chain with circuit breaker
- Queue operations under failure conditions
- End-to-end webhook processing
- Health check integration

### Performance Tests
- Circuit breaker recovery time
- Error handling performance
- Memory usage under load

## Deployment Considerations

### Backward Compatibility
- All changes must maintain existing API contracts
- Configuration remains backward compatible
- No breaking changes to external interfaces

### Rollout Strategy
- Implement circuit breakers first
- Add error handling in subsequent phases
- Separate concerns last (least impact on runtime)

## Risk Assessment

### High Risk
- **Task 9**: Database transaction changes could cause data loss
- Mitigation: Comprehensive rollback procedures and extensive testing

### Medium Risk
- **Task 1**: Circuit breaker implementation complexity
- Mitigation: Phased implementation with extensive unit tests

### Low Risk
- **Task 10**: Structured logging implementation
- Mitigation: Standard logging patterns and minimal runtime impact

## Acceptance Criteria

1. All circuit breakers must pass unit tests covering state transitions
2. JSON parsing errors must be logged and handled gracefully
3. All bare `catch` blocks must be replaced with structured error handling
4. Input validation must reject malformed messages
5. Database operations must be atomic with proper rollback
6. All logging must be structured with correlation IDs
7. Health checks must verify all external dependencies
8. All existing functionality must continue to work unchanged
9. Performance must not degrade significantly (>5% latency increase)
10. Memory usage must remain within defined limits

## Implementation Timeline

This plan requires **4-6 weeks** for complete implementation, with the most critical changes (circuit breakers, error handling, and transactions) taking priority.

## Monitoring and Alerting

Post-implementation monitoring requirements:
- Circuit breaker state changes
- Error rate thresholds
- Database operation failures
- Queue operation failures
- Memory usage patterns
- Performance metrics

All monitoring must be implemented with structured logging to enable effective alerting.

---

**Next Steps**: Begin with Task 1 (Circuit Breaker Class) as it provides the foundation for all subsequent changes. Proceed through the ticket sequence in the specified order to ensure proper dependencies are met.

**Important**: All implementation must maintain backward compatibility while significantly improving system resilience and observability.