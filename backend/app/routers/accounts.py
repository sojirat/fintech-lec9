from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.db.models import Account, AccountBalance, LedgerEntry, AccountStatus

router = APIRouter(prefix="/accounts", tags=["accounts"])

class UpdateAccountStatusRequest(BaseModel):
    status: str

@router.get("/me")
def my_accounts(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    rows = db.query(Account).filter(Account.owner_user_id == int(user_id)).all()
    return [{"account_id": r.account_id, "status": r.status} for r in rows]

@router.get("/{account_id}/balance")
def get_balance(account_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    acct = db.query(Account).filter(Account.account_id == account_id).first()
    if not acct or acct.owner_user_id != int(user_id):
        raise HTTPException(status_code=404, detail="Account not found")
    bal = db.query(AccountBalance).filter(AccountBalance.account_id == account_id).first()
    return {"account_id": account_id, "balance": float(bal.balance) if bal else 0.0}

@router.get("/{account_id}/transactions")
def get_transactions(account_id: str, limit: int = 50, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    acct = db.query(Account).filter(Account.account_id == account_id).first()
    if not acct or acct.owner_user_id != int(user_id):
        raise HTTPException(status_code=404, detail="Account not found")
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.account_id == account_id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )
    return [
        {
            "entry_id": e.entry_id,
            "direction": e.direction,
            "amount": float(e.amount),
            "ref_transfer_id": e.ref_transfer_id,
            "created_at": e.created_at.isoformat(),
        }
        for e in entries
    ]

@router.patch("/{account_id}/status")
def update_account_status(
    account_id: str,
    payload: UpdateAccountStatusRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    acct = db.query(Account).filter(Account.account_id == account_id).first()
    if not acct or acct.owner_user_id != int(user_id):
        raise HTTPException(status_code=404, detail="Account not found")

    valid_statuses = [status.value for status in AccountStatus]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    acct.status = payload.status
    db.commit()

    return {"account_id": account_id, "status": acct.status, "message": "Account status updated successfully"}
