from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from passlib.context import CryptContext

from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.core.idempotency import IdempotencyMiddleware
from app.db.session import engine, SessionLocal
from app.db.models import Base, User, Account, AccountBalance
from app.routers import auth, accounts, transfers, webhooks

app = FastAPI(title="Lab9 Mock Bank API (BaaS Starter Kit)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
app.add_middleware(RateLimitMiddleware, redis=redis_client)
app.add_middleware(IdempotencyMiddleware, redis=redis_client, ttl_seconds=24 * 3600)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transfers.router)
app.include_router(webhooks.router)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            demo_user = User(username="student", password_hash=pwd_context.hash("studentpass"))
            db.add(demo_user)
            db.flush()

            a1 = Account(account_id="ACC1001", owner_user_id=demo_user.user_id, status="active")
            a2 = Account(account_id="ACC2001", owner_user_id=demo_user.user_id, status="active")
            db.add_all([a1, a2])
            db.flush()

            db.add(AccountBalance(account_id="ACC1001", balance=1000.00))
            db.add(AccountBalance(account_id="ACC2001", balance=250.00))
            db.commit()
    finally:
        db.close()

@app.get("/health")
def health():
    return {"ok": True}
