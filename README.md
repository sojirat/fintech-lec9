# Lab 9 — Banking-as-a-Service (BaaS) Starter Kit (FastAPI + Next.js + Docker)

Complete runnable starter kit with account freeze functionality:
- FastAPI backend: JWT auth, ACID transfers, ledger, audit logs, account status management
- PostgreSQL: source-of-truth storage
- Redis: Idempotency-Key cache + rate limit counters
- Next.js frontend: Login, Dashboard, Transfer, Transfer Status, Recent Transfers, Transactions
- Docker Compose to run all services

## Quick Start

```bash
docker compose up -d --build
```

Open:
- Backend Swagger: http://localhost:8000/docs
- Frontend: http://localhost:3000

## Demo Credentials (seeded)

- username: `student`
- password: `studentpass`

Seeded accounts:
- `ACC1001` balance 1000.00
- `ACC2001` balance 250.00

## Features

### Core Banking Operations
- **JWT Authentication**: Secure login with token-based auth
- **ACID Transfers**: Atomic transfers with row-level locking
- **Double-Entry Ledger**: All transfers create DEBIT and CREDIT entries
- **Idempotency**: Prevents duplicate transfers using Idempotency-Key header
- **Rate Limiting**: Per-user rate limits on sensitive endpoints
- **Async Processing**: Background transfer finalization with webhook notifications

### Account Management
- **Account Status**: Three states - `active`, `frozen`, `closed`
- **Freeze Accounts**: Block all transfers from/to frozen accounts
- **Status Validation**: Checked both at request time and during atomic execution

### Transfer Features
- **Transfer Status Lookup**: Query any transfer by ID
- **Recent Transfers**: View transaction history with pagination
- **Validation**: Prevents self-transfers and enforces account status rules

### UI Pages
1. **Login** - Authenticate with demo credentials
2. **Dashboard** - View balance, freeze/unfreeze accounts
3. **Transfer** - Send money with sync/async modes
4. **Transfer Status** - Look up transfer details by ID
5. **Recent Transfers** - Browse transfer history
6. **Transactions** - View ledger entries (DEBIT/CREDIT)

## What to Test

1. **Security test**: Call `/transfers` without Bearer token → 401
2. **Validation test**: Send negative amount → 422 from FastAPI
3. **Idempotency test**: Repeat same request with same `Idempotency-Key` → no double debit
4. **Rate limit test**: Spam balance endpoint → 429
5. **Async test**: Use `"mode":"async"` → accepted, then finalized in background
6. **Freeze test**: Freeze an account, try to transfer → 403 error
7. **Self-transfer test**: Try transferring to same account → 400 error

## API Cheatsheet

### Authentication
- `POST /auth/login` - Get JWT token (x-www-form-urlencoded)

### Account Management
- `GET /accounts/me` - List user's accounts
- `GET /accounts/{account_id}/balance` - Get account balance
- `GET /accounts/{account_id}/transactions?limit=50` - Get ledger entries
- `PATCH /accounts/{account_id}/status` - Update account status (active/frozen/closed)

### Transfers
- `POST /transfers` - Create transfer (requires Bearer token, supports Idempotency-Key)
- `GET /transfers/{transfer_id}` - Get transfer status
- `GET /transfers?limit=50` - List recent transfers for user's accounts

### Webhooks
- `POST /webhooks/transfer-status` - Demo webhook receiver

## Example cURL Commands

### Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=student&password=studentpass"
```

### Create Transfer
```bash
TOKEN="paste_token_here"
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 11111111-1111-1111-1111-111111111111" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":10,"mode":"sync"}'
```

### Get Transfer Status
```bash
curl http://localhost:8000/transfers/{transfer_id} \
  -H "Authorization: Bearer $TOKEN"
```

### Get Recent Transfers
```bash
curl http://localhost:8000/transfers?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

### Freeze Account
```bash
curl -X PATCH http://localhost:8000/accounts/ACC1001/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"frozen"}'
```

### Unfreeze Account
```bash
curl -X PATCH http://localhost:8000/accounts/ACC1001/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}'
```

## Architecture Highlights

### Security & Reliability
- **JWT Authentication**: HS256 token-based auth with bcrypt password hashing
- **CORS Protection**: Configured for localhost:3000 in development
- **Rate Limiting**: Redis-backed fixed-window rate limiting per user
- **Idempotency**: 24-hour cache prevents duplicate operations

### Data Consistency
- **ACID Guarantees**: PostgreSQL transactions with row-level locking
- **Deadlock Prevention**: Sorted account locking order
- **Double-Entry Bookkeeping**: Every transfer creates matching DEBIT/CREDIT entries
- **Atomic Status Checks**: Account status validated inside transaction lock

### Transfer Validation Layers
1. **Request validation**: Check account ownership and existence
2. **Business rules**: Prevent self-transfers, frozen accounts
3. **Atomic validation**: Re-check status inside database lock
4. **Balance check**: Ensure sufficient funds

### Account Status Enforcement
- **Three states**: active (normal), frozen (blocks transfers), closed (archived)
- **Dual validation**: Checked at request time AND during atomic execution
- **Race condition safe**: Status verified while holding row locks

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py          # JWT authentication
│   │   │   ├── accounts.py      # Account management & status
│   │   │   ├── transfers.py     # Transfer operations
│   │   │   └── webhooks.py      # Webhook receiver
│   │   ├── core/
│   │   │   ├── security.py      # JWT & password utilities
│   │   │   ├── config.py        # Settings
│   │   │   ├── rate_limit.py    # Rate limiting middleware
│   │   │   └── idempotency.py   # Idempotency middleware
│   │   ├── db/
│   │   │   ├── models.py        # SQLAlchemy models
│   │   │   └── session.py       # Database connection
│   │   └── main.py              # FastAPI app
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── login/               # Login page
│   │   ├── dashboard/           # Balance & freeze controls
│   │   ├── transfer/            # Create transfers
│   │   ├── transfer-status/     # Lookup transfer by ID
│   │   ├── recent-transfers/    # Browse transfer history
│   │   └── transactions/        # View ledger entries
│   ├── lib/
│   │   └── api.ts               # API client utilities
│   └── package.json
└── docker-compose.yml           # Orchestration
```
