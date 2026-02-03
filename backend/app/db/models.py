from __future__ import annotations
from datetime import datetime
import enum

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric, Text, UniqueConstraint

class Base(DeclarativeBase):
    pass

class AccountStatus(str, enum.Enum):
    active = "active"
    frozen = "frozen"
    closed = "closed"

class TransferStatus(str, enum.Enum):
    processing = "PROCESSING"
    success = "SUCCESS"
    failed = "FAILED"

class User(Base):
    __tablename__ = "users"
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    accounts: Mapped[list["Account"]] = relationship(back_populates="owner")

class Account(Base):
    __tablename__ = "accounts"
    account_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default=AccountStatus.active.value)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped["User"] = relationship(back_populates="accounts")
    balance: Mapped["AccountBalance"] = relationship(back_populates="account", uselist=False)

class AccountBalance(Base):
    __tablename__ = "account_balances"
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.account_id"), primary_key=True)
    balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    account: Mapped["Account"] = relationship(back_populates="balance")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    entry_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.account_id"), index=True)
    direction: Mapped[str] = mapped_column(String(8))  # DEBIT/CREDIT
    amount: Mapped[float] = mapped_column(Numeric(18, 2))
    ref_transfer_id: Mapped[str] = mapped_column(String(36), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Transfer(Base):
    __tablename__ = "transfers"
    transfer_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    from_acct: Mapped[str] = mapped_column(String(32), index=True)
    to_acct: Mapped[str] = mapped_column(String(32), index=True)
    amount: Mapped[float] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(16), default=TransferStatus.processing.value)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("from_acct", "to_acct", "amount", "idempotency_key", name="uq_transfer_idem"),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"
    audit_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(64))
    object_type: Mapped[str] = mapped_column(String(64))
    object_id: Mapped[str] = mapped_column(String(64))
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
