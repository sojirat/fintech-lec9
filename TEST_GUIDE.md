# Lab 9 Testing Guide — Evidence Submission Checklist

This guide helps you demonstrate all required features for lab submission.

---

## 1. Run Full Stack with Docker Compose

### Start Services

```bash
docker compose up -d --build
```

### Verify All Services Running

```bash
docker compose ps
```

**Expected Output:**
```
NAME                        STATUS    PORTS
fintech-lec9-backend-1      Up        0.0.0.0:8000->8000/tcp
fintech-lec9-frontend-1     Up        0.0.0.0:3000->3000/tcp
fintech-lec9-postgres-1     Up        5432/tcp
fintech-lec9-redis-1        Up        6379/tcp
```

### Evidence to Capture:
- [ ] Screenshot of `docker compose ps` showing all 4 services running
- [ ] Screenshot of http://localhost:3000 (frontend loads)
- [ ] Screenshot of http://localhost:8000/docs (Swagger UI loads)

---

## 2. Login and JWT Authentication

### Step 1: Login via UI

1. Go to http://localhost:3000/login
2. Login with:
   - Username: `student`
   - Password: `studentpass`
3. After successful login, you should see "Logout" in the navigation menu

### Step 2: Login via API (cURL)

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=student&password=studentpass"
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Step 3: Call Protected Endpoint WITHOUT Token (401)

```bash
curl -X GET http://localhost:8000/accounts/me
```

**Expected Response:**
```json
{
  "detail": "Not authenticated"
}
```

**HTTP Status: 401 Unauthorized**

### Step 4: Call Protected Endpoint WITH Token (200)

```bash
TOKEN="your_token_here"
curl -X GET http://localhost:8000/accounts/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {"account_id": "ACC1001", "status": "active"},
  {"account_id": "ACC2001", "status": "active"},
  {"account_id": "ACC3001", "status": "active"},
  ...
]
```

**HTTP Status: 200 OK**

### Evidence to Capture:
- [ ] Screenshot of successful login (UI or terminal with token)
- [ ] Screenshot of 401 error when calling `/accounts/me` without token
- [ ] Screenshot of 200 success when calling `/accounts/me` with Bearer token
- [ ] Screenshot showing "Logout" menu item after login

---

## 3. Atomic Money Movement (Double-Entry Ledger)

### Step 1: Check Initial Balances

```bash
TOKEN="your_token_here"
curl http://localhost:8000/accounts/ACC1001/balance -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/accounts/ACC2001/balance -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{"account_id": "ACC1001", "balance": 1000.0}
{"account_id": "ACC2001", "balance": 250.0}
```

### Step 2: Make a Transfer

```bash
TOKEN="your_token_here"
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 11111111-1111-1111-1111-111111111111" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":100,"mode":"sync"}'
```

**Expected Response:**
```json
{
  "status": "success",
  "transfer_id": "uuid-here"
}
```

### Step 3: Verify Balances Updated (Atomic Debit + Credit)

```bash
curl http://localhost:8000/accounts/ACC1001/balance -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/accounts/ACC2001/balance -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{"account_id": "ACC1001", "balance": 900.0}   // 1000 - 100
{"account_id": "ACC2001", "balance": 350.0}   // 250 + 100
```

### Step 4: Verify Double-Entry Ledger

```bash
curl "http://localhost:8000/accounts/ACC1001/transactions?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (excerpt):**
```json
[
  {
    "entry_id": 1,
    "direction": "DEBIT",
    "amount": 100.0,
    "ref_transfer_id": "uuid-here",
    "created_at": "2026-02-03T..."
  }
]
```

```bash
curl "http://localhost:8000/accounts/ACC2001/transactions?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (excerpt):**
```json
[
  {
    "entry_id": 2,
    "direction": "CREDIT",
    "amount": 100.0,
    "ref_transfer_id": "uuid-here",
    "created_at": "2026-02-03T..."
  }
]
```

### Evidence to Capture:
- [ ] Screenshot of initial balances (ACC1001: 1000.00, ACC2001: 250.00)
- [ ] Screenshot of successful transfer response
- [ ] Screenshot of updated balances (ACC1001: 900.00, ACC2001: 350.00)
- [ ] Screenshot of ledger entries showing DEBIT and CREDIT with same `ref_transfer_id`

---

## 4. Validation Tests

### Test 4.1: Negative Amount (422 Validation Error)

```bash
TOKEN="your_token_here"
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":-50,"mode":"sync"}'
```

**Expected Response:**
```json
{
  "detail": [
    {
      "type": "greater_than",
      "loc": ["body", "amount"],
      "msg": "Input should be greater than 0",
      "input": -50
    }
  ]
}
```

**HTTP Status: 422 Unprocessable Entity**

### Test 4.2: Insufficient Funds (400 Error)

First, create an account with low balance or transfer until balance is insufficient:

```bash
TOKEN="your_token_here"
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":999999,"mode":"sync"}'
```

**Expected Response:**
```json
{
  "detail": "Insufficient funds"
}
```

**HTTP Status: 400 Bad Request**

### Test 4.3: Self-Transfer (400 Error)

```bash
TOKEN="your_token_here"
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC1001","amount":10,"mode":"sync"}'
```

**Expected Response:**
```json
{
  "detail": "Cannot transfer to the same account"
}
```

**HTTP Status: 400 Bad Request**

### Test 4.4: Frozen Account (403 Error)

First, freeze an account:

```bash
TOKEN="your_token_here"
curl -X PATCH http://localhost:8000/accounts/ACC1001/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"frozen"}'
```

Then try to transfer:

```bash
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":10,"mode":"sync"}'
```

**Expected Response:**
```json
{
  "detail": "Source account is frozen and cannot send transfers"
}
```

**HTTP Status: 403 Forbidden**

Don't forget to unfreeze:

```bash
curl -X PATCH http://localhost:8000/accounts/ACC1001/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}'
```

### Evidence to Capture:
- [ ] Screenshot of 422 error for negative amount
- [ ] Screenshot of 400 error for insufficient funds
- [ ] Screenshot of 400 error for self-transfer
- [ ] Screenshot of 403 error for frozen account transfer
- [ ] Screenshot of successful freeze/unfreeze operation

---

## 5. Idempotency (Duplicate Prevention)

### Step 1: Make a Transfer with Specific Idempotency-Key

```bash
TOKEN="your_token_here"
IDEM_KEY="22222222-2222-2222-2222-222222222222"

curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":50,"mode":"sync"}'
```

**Expected Response (First Call):**
```json
{
  "status": "success",
  "transfer_id": "uuid-abc-123"
}
```

### Step 2: Check Balance After First Transfer

```bash
curl http://localhost:8000/accounts/ACC1001/balance -H "Authorization: Bearer $TOKEN"
```

**Expected:** Balance decreased by 50

### Step 3: Repeat EXACT Same Request (Same Idempotency-Key)

```bash
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":50,"mode":"sync"}'
```

**Expected Response (Second Call):**
```json
{
  "status": "success",
  "transfer_id": "uuid-abc-123"
}
```

**SAME transfer_id as first call!**

### Step 4: Verify Balance NOT Deducted Twice

```bash
curl http://localhost:8000/accounts/ACC1001/balance -H "Authorization: Bearer $TOKEN"
```

**Expected:** Balance should be the SAME as after Step 2 (only deducted once, not twice)

### Evidence to Capture:
- [ ] Screenshot of first transfer with specific Idempotency-Key
- [ ] Screenshot of balance after first transfer
- [ ] Screenshot of second transfer with SAME Idempotency-Key
- [ ] Screenshot showing SAME transfer_id returned
- [ ] Screenshot of balance unchanged (proving no double deduction)

---

## 6. Rate Limiting

### Test: Spam Endpoint to Trigger Rate Limit (429 Error)

Run this command multiple times rapidly (>100 times in 1 minute):

```bash
TOKEN="your_token_here"
for i in {1..150}; do
  curl -s http://localhost:8000/accounts/ACC1001/balance \
    -H "Authorization: Bearer $TOKEN" &
done
wait
```

Or use a single-line bash loop:

```bash
TOKEN="your_token_here"
for i in {1..150}; do
  echo "Request $i"
  curl http://localhost:8000/accounts/ACC1001/balance \
    -H "Authorization: Bearer $TOKEN"
  sleep 0.1
done
```

**Expected Response (after exceeding limit):**
```json
{
  "detail": "Rate limit exceeded"
}
```

**HTTP Status: 429 Too Many Requests**

### Evidence to Capture:
- [ ] Screenshot showing 429 error after rapid requests
- [ ] Terminal output showing multiple requests with final 429 response

---

## 7. Async Transfer Mode

### Step 1: Create Async Transfer

```bash
TOKEN="your_token_here"
curl -X POST http://localhost:8000/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 33333333-3333-3333-3333-333333333333" \
  -d '{"from_acct":"ACC1001","to_acct":"ACC2001","amount":25,"mode":"async"}'
```

**Expected Response (Immediate):**
```json
{
  "status": "accepted",
  "transfer_id": "uuid-xyz-789"
}
```

**Status is "accepted", NOT "success"!**

### Step 2: Wait 3-5 Seconds, Then Check Transfer Status

```bash
TRANSFER_ID="uuid-xyz-789"
curl http://localhost:8000/transfers/$TRANSFER_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (After Background Processing):**
```json
{
  "transfer_id": "uuid-xyz-789",
  "from_acct": "ACC1001",
  "to_acct": "ACC2001",
  "amount": 25.0,
  "status": "SUCCESS",
  "created_at": "2026-02-03T...",
  "idempotency_key": "33333333-3333-3333-3333-333333333333"
}
```

**Status changed from "accepted" → "SUCCESS"**

### Evidence to Capture:
- [ ] Screenshot of async transfer response with `"status": "accepted"`
- [ ] Screenshot of transfer status check showing `"status": "SUCCESS"` after waiting
- [ ] Screenshot showing balance updated after async processing

---

## 8. UI Testing (Bonus)

### Dashboard Features

1. **View Balance**: Auto-refreshes every 4 seconds
2. **Freeze Account**: Click "Freeze Account" button
   - Verify status shows "frozen"
   - Try to transfer → should show error
3. **Unfreeze Account**: Click "Activate Account" button
   - Verify status shows "active"
   - Transfer should work again
4. **Close Account**: Click "Close Account" button
   - Requires confirmation
   - Status shows "closed"
   - Cannot revert (permanent)

### Evidence to Capture:
- [ ] Screenshot of Dashboard showing balance and account status
- [ ] Screenshot of frozen account with error message when attempting transfer
- [ ] Screenshot of Transfer page with successful transfer
- [ ] Screenshot of Recent Transfers page showing transfer history
- [ ] Screenshot of Transactions page showing DEBIT/CREDIT ledger entries

---

## Summary Checklist

### Required Evidence:

1. **Docker Compose Running** ✅
   - [x] `docker compose ps` showing 4 services up

2. **JWT Authentication** ✅
   - [x] 401 error without token
   - [x] 200 success with Bearer token

3. **Atomic Money Movement** ✅
   - [x] Balances updated correctly (debit + credit)
   - [x] Double-entry ledger with DEBIT and CREDIT entries

4. **Validation** ✅
   - [x] 422 for negative amount
   - [x] 400 for insufficient funds
   - [x] 400 for self-transfer
   - [x] 403 for frozen account

5. **Idempotency** ✅
   - [x] Same transfer_id returned for duplicate requests
   - [x] Balance only deducted once (not twice)

6. **Rate Limiting** ✅
   - [x] 429 error after exceeding request limit

### Bonus Evidence:

7. **Async Mode** ✅
   - [x] "accepted" status immediately
   - [x] "SUCCESS" status after background processing

8. **UI Screenshots** ✅
   - [x] Dashboard, Transfer, Transactions pages working

---

## Tips for Submission

1. **Organize Screenshots**: Create a folder with numbered screenshots matching each test
2. **Include Terminal Output**: Copy-paste cURL commands and responses into a text file
3. **Verify HTTP Status Codes**: Show the HTTP status code (200, 400, 401, 403, 422, 429) in screenshots
4. **Show Full Workflow**: Demonstrate before/after state (e.g., balance before transfer → transfer → balance after)
5. **Use Different Idempotency-Keys**: For each new transfer test to avoid conflicts

---

## Quick Reset Database (If Needed)

If you need to reset to initial state:

```bash
docker compose down -v
docker compose up -d --build
```

This will recreate the database with fresh seed data:
- ACC1001: 1000.00
- ACC2001: 250.00
- ACC3001-ACC3010: 500.00 each
