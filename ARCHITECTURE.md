# Architecture Documentation

This document explains the technical architecture and design decisions for the Banking-as-a-Service (BaaS) starter kit.

## Table of Contents

1. [Technology Stack Overview](#technology-stack-overview)
2. [Authentication & Token Storage](#authentication--token-storage)
3. [Database Architecture: PostgreSQL vs Redis](#database-architecture-postgresql-vs-redis)
4. [Account Status Lifecycle](#account-status-lifecycle)
5. [Transfer Processing Flow](#transfer-processing-flow)
6. [Dual Validation Pattern](#dual-validation-pattern)
7. [Concurrency & Race Condition Prevention](#concurrency--race-condition-prevention)

---

## Technology Stack Overview

### Backend
- **FastAPI**: Python async web framework with automatic OpenAPI documentation
- **SQLAlchemy**: ORM for PostgreSQL with support for complex queries and transactions
- **PostgreSQL**: Primary persistent storage with ACID guarantees
- **Redis**: In-memory cache for idempotency and rate limiting
- **bcrypt**: Password hashing for secure credential storage
- **PyJWT**: HS256 JWT token generation and validation

### Frontend
- **Next.js 14**: React framework with App Router (Server Components + Client Components)
- **TypeScript**: Type-safe JavaScript for better developer experience
- **localStorage**: Browser API for JWT token storage

---

## Authentication & Token Storage

### How It Works

1. **Login Flow**:
   ```
   User enters credentials → POST /auth/login → Backend validates with bcrypt
   → Generate JWT token (HS256) → Return token to frontend
   → Frontend stores in localStorage → Include in all API requests as Bearer token
   ```

2. **Token Storage Location**:
   - **localStorage**: Persists across browser tabs and sessions until manually cleared
   - **Why not sessionStorage?**: Would require re-login on every new tab
   - **Why not backend session?**: Stateless architecture scales better (no session store needed)

3. **JWT Token Structure**:
   ```json
   {
     "sub": "1",              // user_id
     "exp": 1709481600        // expiration timestamp
   }
   ```

### Security Considerations

| Storage Method | Pros | Cons |
|----------------|------|------|
| **localStorage** (current) | Persists across tabs/sessions | Vulnerable to XSS attacks |
| sessionStorage | Auto-clears on tab close | Inconvenient (re-login per tab) |
| httpOnly Cookie | Protected from JavaScript XSS | Requires CSRF protection |

**Current Trade-off**: We use localStorage for developer convenience in this educational starter kit. Production systems should consider httpOnly cookies with CSRF tokens.

---

## Database Architecture: PostgreSQL vs Redis

### Why Two Databases?

Both databases serve **different purposes** and work together:

| Database | Purpose | Data Type | Persistence | Use Cases |
|----------|---------|-----------|-------------|-----------|
| **PostgreSQL** | Source of truth | Structured relational data | Permanent (disk) | Accounts, balances, transfers, audit logs |
| **Redis** | Cache & counters | Key-value pairs | Temporary (memory + optional AOF) | Idempotency keys (24h), rate limit counters (1 min windows) |

### PostgreSQL: The Source of Truth

**What it stores**:
- User accounts and credentials
- Account balances (decimal precision)
- Double-entry ledger (DEBIT/CREDIT entries)
- Transfer records with status
- Audit logs for compliance

**Why PostgreSQL**:
- **ACID Guarantees**: Atomic transfers (all-or-nothing), consistent balances
- **Row-Level Locking**: `SELECT ... FOR UPDATE` prevents race conditions
- **Complex Queries**: JOIN across accounts, transfers, ledger entries
- **Decimal Precision**: NUMERIC type prevents floating-point errors in money calculations
- **Persistent Storage**: Data survives server restarts

**Example Transfer Transaction**:
```sql
BEGIN;
SELECT account_id FROM accounts WHERE account_id IN ('ACC1001', 'ACC2001') FOR UPDATE;
-- Check balances and status
UPDATE account_balances SET balance = balance - 10 WHERE account_id = 'ACC1001';
UPDATE account_balances SET balance = balance + 10 WHERE account_id = 'ACC2001';
INSERT INTO ledger_entries (account_id, direction, amount) VALUES ('ACC1001', 'DEBIT', 10);
INSERT INTO ledger_entries (account_id, direction, amount) VALUES ('ACC2001', 'CREDIT', 10);
INSERT INTO transfers (transfer_id, status) VALUES ('uuid', 'success');
COMMIT;
```

### Redis: High-Speed Cache

**What it stores**:
- **Idempotency Keys**: `idem:{uuid}` → transfer_id (TTL: 24 hours)
- **Rate Limit Counters**: `rate:{user_id}:{endpoint}:{window}` → count (TTL: 60 seconds)

**Why Redis**:
- **In-Memory Speed**: Sub-millisecond response times for cache lookups
- **Atomic Operations**: `INCR` for rate limiting without race conditions
- **TTL Support**: Automatic expiration of old idempotency keys
- **Set Operations**: Fast duplicate detection (SETNX for idempotency)

**Example Idempotency Flow**:
```python
# Check if transfer already processed
existing = redis.get(f"idem:{idempotency_key}")
if existing:
    return {"transfer_id": existing}  # Return cached result

# Process new transfer
transfer_id = create_transfer()
redis.setex(f"idem:{idempotency_key}", 86400, transfer_id)  # Cache for 24h
```

### Workflow: How They Work Together

**Transfer Creation Flow**:
```
1. Client sends POST /transfers with Idempotency-Key header
2. Check Redis: Has this key been processed?
   - YES → Return cached transfer_id (prevents duplicate)
   - NO → Continue
3. Validate request (check account ownership, status)
4. Begin PostgreSQL transaction
   - Lock account rows (FOR UPDATE)
   - Re-check status inside lock (race condition safe)
   - Update balances
   - Insert ledger entries
   - Insert transfer record
   - Commit transaction
5. Store in Redis: idem:{key} → transfer_id (24h TTL)
6. Return success response
```

---

## Account Status Lifecycle

### Three Status States

```
┌─────────┐
│ active  │ ←──────────────────┐
└────┬────┘                    │
     │                         │
     │ PATCH /status          │ PATCH /status
     │ {"status":"frozen"}    │ {"status":"active"}
     │                         │
     ▼                         │
┌─────────┐                    │
│ frozen  │ ───────────────────┘
└────┬────┘     (reversible)
     │
     │ PATCH /status
     │ {"status":"closed"}
     │ (requires confirmation)
     │
     ▼
┌─────────┐
│ closed  │  (permanent, cannot revert)
└─────────┘
```

### Status Behavior

| Status | Can Send Transfers? | Can Receive Transfers? | Can Revert? |
|--------|---------------------|------------------------|-------------|
| **active** | ✅ Yes | ✅ Yes | N/A (default state) |
| **frozen** | ❌ No (403 error) | ❌ No (403 error) | ✅ Yes (back to active) |
| **closed** | ❌ No (403 error) | ❌ No (403 error) | ❌ No (permanent) |

### Use Cases

- **Freeze**: Temporary suspension for suspicious activity investigation, security holds, or user-requested pause
- **Close**: Permanent account termination, user deleted account, compliance closure

---

## Transfer Processing Flow

### Sync Mode (Default)

```
Client Request
     ↓
JWT Validation
     ↓
Rate Limit Check (Redis)
     ↓
Idempotency Check (Redis) ──→ [Duplicate] Return cached transfer_id
     ↓
Request Validation
  - Account ownership
  - Account existence
  - Status check (active?)
  - Self-transfer check
     ↓
BEGIN PostgreSQL Transaction
     ↓
Lock Account Rows (sorted order)
     ↓
Atomic Validation Inside Lock
  - Re-check status (race safe)
  - Check sufficient balance
     ↓
Execute Transfer
  - Update balances
  - Insert ledger entries (DEBIT/CREDIT)
  - Update transfer status → success
     ↓
COMMIT Transaction
     ↓
Cache in Redis (24h TTL)
     ↓
Send Webhook Notification (async)
     ↓
Return success response
```

### Async Mode (Background Processing)

```
Client Request
     ↓
[Same validation steps as sync]
     ↓
Create Transfer Record (status: processing)
     ↓
COMMIT (save transfer to DB)
     ↓
Add Background Task
     ↓
Return {"status": "accepted", "transfer_id": "..."}
     ↓
[Client receives immediate response]

Background Task (after 2 seconds):
     ↓
BEGIN Transaction
     ↓
[Same locking + validation + execution as sync]
     ↓
Update transfer status → success/failed
     ↓
COMMIT
     ↓
Send Webhook Notification
```

---

## Dual Validation Pattern

### Why Validate Twice?

**Problem**: Race condition between status check and transfer execution

```
Time →

Thread A: Check status (active) ✅
Thread B: Check status (active) ✅
Thread B: Lock accounts → Execute transfer ✅
Admin:    Freeze account
Thread A: Lock accounts → Execute transfer ❌ (should fail but doesn't!)
```

### Solution: Dual Validation

**1. Request-Time Validation** (lines 92-99 in [transfers.py](backend/app/routers/transfers.py:92-99)):
- Fast fail for obvious violations
- Check account ownership
- Check existence
- **Initial status check** (before transaction)

```python
# Early validation (fast fail)
if from_account.status == "frozen":
    raise HTTPException(status_code=403, detail="Source account is frozen")
```

**2. Atomic Validation Inside Transaction** (lines 61-75 in [transfers.py](backend/app/routers/transfers.py:61-75)):
- **Re-check status while holding row lock**
- Prevents race conditions
- Guarantees consistency

```python
def _apply_transfer_atomic(db: Session, from_acct: str, to_acct: str, amount: Decimal, transfer_id: str):
    # Lock accounts first (sorted order to prevent deadlocks)
    ordered = sorted([from_acct, to_acct])
    for aid in ordered:
        _lock_account_row(db, aid)  # SELECT ... FOR UPDATE

    # Re-check status INSIDE the lock
    from_account = db.query(Account).filter(Account.account_id == from_acct).first()
    to_account = db.query(Account).filter(Account.account_id == to_acct).first()

    if from_account.status == "frozen":
        raise HTTPException(status_code=403, detail="Source account is frozen")
    # ... proceed with transfer
```

### Timeline with Dual Validation

```
Thread A: Check status (active) ✅
Thread B: Check status (active) ✅
Thread B: Lock accounts (A waits here) 🔒
Admin:    Freeze account
Thread B: Re-check status inside lock → FROZEN ❌ → Rollback
Thread A: Lock accounts 🔒
Thread A: Re-check status inside lock → FROZEN ❌ → Rollback
```

**Result**: Both transfers correctly rejected due to atomic validation.

---

## Concurrency & Race Condition Prevention

### Deadlock Prevention: Sorted Locking

**Problem**: Two transfers locking accounts in different order can deadlock

```
Transfer X: ACC1001 → ACC2001
Transfer Y: ACC2001 → ACC1001

Transfer X: Lock ACC1001 🔒
Transfer Y: Lock ACC2001 🔒
Transfer X: Waiting for ACC2001... ⏳
Transfer Y: Waiting for ACC1001... ⏳
DEADLOCK! 💥
```

**Solution**: Always lock accounts in sorted order

```python
ordered = sorted([from_acct, to_acct])  # ['ACC1001', 'ACC2001']
for aid in ordered:
    _lock_account_row(db, aid)
```

**Result**: Both transfers lock ACC1001 first, then ACC2001 → No deadlock

### Idempotency: Preventing Duplicate Transfers

**Problem**: Network retry or duplicate request could execute transfer twice

**Solution**: Idempotency-Key header + Redis cache

```python
# Check cache first
cached = redis.get(f"idem:{idempotency_key}")
if cached:
    return {"transfer_id": cached}  # Return existing result

# Process transfer
transfer_id = execute_transfer()

# Cache result for 24 hours
redis.setex(f"idem:{idempotency_key}", 86400, transfer_id)
```

**Guarantee**: Same Idempotency-Key always returns same transfer_id

### Rate Limiting: Preventing Abuse

**Implementation**: Fixed-window counter in Redis

```python
key = f"rate:{user_id}:/accounts/balance:{current_minute}"
count = redis.incr(key)
redis.expire(key, 60)  # Reset after 60 seconds

if count > limit:
    raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

**Example**: Max 100 requests per minute per user

---

## Summary

This architecture provides:

1. **Security**: JWT authentication, bcrypt passwords, rate limiting
2. **Consistency**: PostgreSQL ACID transactions with row-level locking
3. **Performance**: Redis caching for idempotency and rate limits
4. **Reliability**: Dual validation prevents race conditions
5. **Scalability**: Stateless authentication, background async processing
6. **Compliance**: Audit logs, double-entry ledger, account status controls

For questions or clarifications, refer to the main [README.md](README.md) or explore the codebase structure in the project files.
