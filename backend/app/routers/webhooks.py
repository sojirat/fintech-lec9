from __future__ import annotations
from fastapi import APIRouter

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/transfer-status")
def transfer_status(payload: dict):
    return {"received": True, "payload": payload}
