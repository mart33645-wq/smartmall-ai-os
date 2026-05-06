from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from core.deps import get_current_user
from models.database import User, get_db
from services.report_service import ReportService

router = APIRouter()


@router.get("/export/pdf")
def export_pdf(
    lang: str = Query("en", pattern="^(ar|en)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pdf_content = ReportService.generate_mall_performance_pdf(db, lang=lang)
    return Response(
        content=pdf_content, 
        media_type="application/pdf", 
        headers={"Content-Disposition": "attachment; filename=SmartMall_Performance_Report.pdf"}
    )
