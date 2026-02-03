from __future__ import annotations
import uuid
import asyncio
from decimal import Decimal
from typing import Optional
import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, PositiveFloat
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.security import get_current_user_id
from app.core.config import settings
from app.db.session import get_db, SessionLocal
from app.db.models import Account, AccountBalance, LedgerEntry, Transfer, TransferStatus, AuditLog

router = APIRouter(tags=["transfers"])

class TransferRequest(BaseModel):
    from_acct: str
    to_acct: str
    amount: PositiveFloat
    mode: Optional[str] = "sync"  # sync | async

def _json_dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))

def _write_audit(db: Session, actor_user_id: int, action: str, object_type: str, object_id: str, request_id: Optional[str], meta: dict):
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            object_type=object_type,
            object_id=object_id,
            request_id=request_id,
            metadata_json=_json_dumps(meta),
        )
    )

def _get_idem_key(request: Request) -> Optional[str]:
    return request.headers.get("idempotency-key")

def _lock_account_row(db: Session, account_id: str):
    db.execute(text("SELECT account_id FROM accounts WHERE account_id = :aid FOR UPDATE"), {"aid": account_id})

def _ensure_balance_row(db: Session, account_id: str):
    bal = db.query(AccountBalance).filter(AccountBalance.account_id == account_id).first()
    if not bal:
        bal = AccountBalance(account_id=account_id, balance=0)
        db.add(bal)
        db.flush()
    return bal

def _apply_transfer_atomic(db: Session, from_acct: str, to_acct: str, amount: Decimal, transfer_id: str):
    ordered = sorted([from_acct, to_acct])
    for aid in ordered:
        _lock_account_row(db, aid)

    # Re-check account status inside the transaction lock
    from_account = db.query(Account).filter(Account.account_id == from_acct).first()
    to_account = db.query(Account).filter(Account.account_id == to_acct).first()

    if not from_account or not to_account:
        raise HTTPException(status_code=404, detail="Account not found")

    if from_account.status == "frozen":
        raise HTTPException(status_code=403, detail="Source account is frozen and cannot send transfers")
    if to_account.status == "frozen":
        raise HTTPException(status_code=403, detail="Destination account is frozen and cannot receive transfers")
    if from_account.status == "closed":
        raise HTTPException(status_code=403, detail="Source account is closed")
    if to_account.status == "closed":
        raise HTTPException(status_code=403, detail="Destination account is closed")

    from_bal = _ensure_balance_row(db, from_acct)
    to_bal = _ensure_balance_row(db, to_acct)

    if Decimal(from_bal.balance) < amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")

    from_bal.balance = Decimal(from_bal.balance) - amount
    to_bal.balance = Decimal(to_bal.balance) + amount

    db.add(LedgerEntry(account_id=from_acct, direction="DEBIT", amount=amount, ref_transfer_id=transfer_id))
    db.add(LedgerEntry(account_id=to_acct, direction="CREDIT", amount=amount, ref_transfer_id=transfer_id))

@router.post("/transfers")
async def create_transfer(
    payload: TransferRequest,
    request: Request,
    bg: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if payload.from_acct == payload.to_acct:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    from_account = db.query(Account).filter(Account.account_id == payload.from_acct).first()
    to_account = db.query(Account).filter(Account.account_id == payload.to_acct).first()

    if not from_account or from_account.owner_user_id != int(user_id):
        raise HTTPException(status_code=404, detail="from_acct not found or not owned by user")
    if not to_account:
        raise HTTPException(status_code=404, detail="to_acct not found")

    if from_account.status == "frozen":
        raise HTTPException(status_code=403, detail="Source account is frozen and cannot send transfers")
    if to_account.status == "frozen":
        raise HTTPException(status_code=403, detail="Destination account is frozen and cannot receive transfers")
    if from_account.status == "closed":
        raise HTTPException(status_code=403, detail="Source account is closed")
    if to_account.status == "closed":
        raise HTTPException(status_code=403, detail="Destination account is closed")

    transfer_id = str(uuid.uuid4())
    idem = _get_idem_key(request)

    t = Transfer(
        transfer_id=transfer_id,
        from_acct=payload.from_acct,
        to_acct=payload.to_acct,
        amount=Decimal(str(payload.amount)),
        status=TransferStatus.processing.value,
        idempotency_key=idem,
    )
    db.add(t)

    req_id = request.headers.get("x-request-id")
    _write_audit(
        db,
        actor_user_id=int(user_id),
        action="transfer_create",
        object_type="transfer",
        object_id=transfer_id,
        request_id=req_id,
        meta={"from": payload.from_acct, "to": payload.to_acct, "amount": float(payload.amount), "mode": payload.mode},
    )

    if payload.mode == "async":
        db.commit()
        bg.add_task(_finalize_async_transfer, transfer_id)
        return {"status": "accepted", "transfer_id": transfer_id}

    try:
        _apply_transfer_atomic(db, payload.from_acct, payload.to_acct, Decimal(str(payload.amount)), transfer_id)
        t.status = TransferStatus.success.value
        db.commit()
        await _notify_webhook(transfer_id, t.status)
        return {"status": "success", "transfer_id": transfer_id}
    except HTTPException:
        db.rollback()
        _mark_failed(db, transfer_id)
        raise
    except Exception:
        db.rollback()
        _mark_failed(db, transfer_id)
        raise HTTPException(status_code=400, detail="Transaction Failed")

@router.get("/transfers/{transfer_id}")
def get_transfer(transfer_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    t = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    acct = db.query(Account).filter(Account.account_id == t.from_acct).first()
    if not acct or acct.owner_user_id != int(user_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"transfer_id": t.transfer_id, "from_acct": t.from_acct, "to_acct": t.to_acct, "amount": float(t.amount), "status": t.status, "created_at": t.created_at.isoformat(), "idempotency_key": t.idempotency_key}

@router.get("/transfers")
def get_recent_transfers(
    limit: int = 50,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")

    user_accounts = db.query(Account).filter(Account.owner_user_id == int(user_id)).all()
    account_ids = [acct.account_id for acct in user_accounts]

    if not account_ids:
        return {"transfers": []}

    transfers = (
        db.query(Transfer)
        .filter(Transfer.from_acct.in_(account_ids))
        .order_by(Transfer.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "transfers": [
            {
                "transfer_id": t.transfer_id,
                "from_acct": t.from_acct,
                "to_acct": t.to_acct,
                "amount": float(t.amount),
                "status": t.status,
                "created_at": t.created_at.isoformat(),
                "idempotency_key": t.idempotency_key,
            }
            for t in transfers
        ]
    }

def _mark_failed(db: Session, transfer_id: str):
    try:
        tt = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
        if tt:
            tt.status = TransferStatus.failed.value
            db.commit()
    except Exception:
        db.rollback()

async def _finalize_async_transfer(transfer_id: str):
    db = SessionLocal()
    try:
        await asyncio.sleep(2)
        t = db.query(Transfer).filter(Transfer.transfer_id == transfer_id).first()
        if not t:
            return
        try:
            _apply_transfer_atomic(db, t.from_acct, t.to_acct, Decimal(str(t.amount)), t.transfer_id)
            t.status = TransferStatus.success.value
            db.commit()
        except Exception:
            db.rollback()
            _mark_failed(db, transfer_id)
        await _notify_webhook(transfer_id, t.status)
    finally:
        db.close()

async def _notify_webhook(transfer_id: str, status: str):
    url = settings.WEBHOOK_URL
    payload = {"transfer_id": transfer_id, "status": status}
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(url, json=payload)
    except Exception:
        return
