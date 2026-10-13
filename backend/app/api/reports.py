from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.schemas import ReportIn
from app.services import report_service as svc
from .deps import current_user, get_db

router = APIRouter(prefix="/api/reports", tags=["reports"], dependencies=[Depends(current_user)])


@router.post("/generate", status_code=201)
def generate(body: ReportIn, db: Session = Depends(get_db)):
    return svc.generate(db, body)


@router.get("")
def list_reports(db: Session = Depends(get_db)):
    return svc.list_reports(db)


@router.get("/{report_id}/download")
def download(report_id: int, db: Session = Depends(get_db)):
    r = svc.get_report(db, report_id)
    return FileResponse(r.file_reference, filename=r.file_reference.split("/")[-1])
