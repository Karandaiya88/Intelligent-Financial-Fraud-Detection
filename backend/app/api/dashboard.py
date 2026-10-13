from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.services import dashboard_service
from .deps import current_user, get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    return dashboard_service.summary(db)
