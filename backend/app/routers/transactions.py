"""Transaction endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Transaction, User
from app.schemas import TransactionCreate, TransactionOut
from app.services.case_service import get_case
from app.services.audit_service import log_event

router = APIRouter(prefix="/api/cases/{case_id}/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def add_transaction(
    case_id: str,
    data: TransactionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    tx = Transaction(
        case_id=case_id,
        amount=data.amount,
        currency=data.currency,
        transaction_at=data.transaction_at,
        order_reference=data.order_reference,
        payment_method=data.payment_method,
        description=data.description,
    )
    db.add(tx)
    db.flush()

    log_event(db, case_id=case_id, event_type="transaction_added", actor="user", payload={
        "amount": data.amount,
        "currency": data.currency,
        "order_reference": data.order_reference,
    })
    db.commit()
    db.refresh(tx)
    return tx


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    case_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return (
        db.query(Transaction)
        .filter(Transaction.case_id == case_id)
        .order_by(Transaction.created_at.desc())
        .all()
    )
