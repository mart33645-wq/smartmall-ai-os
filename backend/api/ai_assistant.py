import datetime

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from core.deps import get_current_user
from models.database import User, get_db
from services.ai_chat_service import AIChatService

router = APIRouter()


@router.post("/chat")
def chat(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = data.get("message") or data.get("query") or ""
    response = AIChatService.analyze_and_respond(db, question)
    return {"response": response, "timestamp": datetime.datetime.utcnow().isoformat() + "Z"}


@router.post("/assistant")
def assistant_alias(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question = data.get("message") or data.get("query") or ""
    response = AIChatService.analyze_and_respond(db, question)
    return {"response": response, "timestamp": datetime.datetime.utcnow().isoformat() + "Z"}
