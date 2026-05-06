from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.deps import get_current_user
from models.database import User, get_db
from schemas.assistant import (
    AssistantActionExecutionResponse,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantConversationResponse,
    AssistantStatusResponse,
    AssistantSystemAnalysisResponse,
)
from services.assistant import SmartMallAssistantOrchestrator

router = APIRouter()


def _assistant(db: Session, current_user: User) -> SmartMallAssistantOrchestrator:
    return SmartMallAssistantOrchestrator(db, current_user)


@router.get("/status", response_model=AssistantStatusResponse)
def assistant_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _assistant(db, current_user).status()


@router.post("/chat", response_model=AssistantChatResponse)
def assistant_chat(
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _assistant(db, current_user).chat(payload)


@router.get("/system-analysis", response_model=AssistantSystemAnalysisResponse)
def system_analysis(
    lang: str = Query("en", pattern="^(ar|en)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _assistant(db, current_user).get_system_analysis(lang=lang)


@router.post("/actions/{action_id}", response_model=AssistantActionExecutionResponse)
def execute_action(
    action_id: str,
    lang: str = Query("en", pattern="^(ar|en)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return _assistant(db, current_user).execute_action(action_id, lang=lang)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/conversations/{conversation_id}", response_model=AssistantConversationResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return _assistant(db, current_user).get_conversation(conversation_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
