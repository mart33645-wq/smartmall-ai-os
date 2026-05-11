"""
Assistant API — all AI chat, streaming, actions, and provider health endpoints.

Endpoints:
  GET  /api/assistant/status           — provider health
  POST /api/assistant/chat             — standard chat (existing)
  POST /api/assistant/stream           — SSE streaming chat (NEW)
  GET  /api/assistant/provider-status  — detailed provider health (NEW)
  GET  /api/assistant/system-analysis  — system analysis
  POST /api/assistant/actions/{id}     — execute a named action
  GET  /api/assistant/conversations/{id} — fetch conversation history
  GET  /api/assistant/audit-logs       — paginated audit log (NEW)
"""
from __future__ import annotations

import json
import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.rate_limit import limiter
from models.database import AuditLog, User, get_db
from schemas.assistant import (
    AssistantActionExecutionResponse,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantConversationResponse,
    AssistantStatusResponse,
    AssistantSystemAnalysisResponse,
)
from services.assistant import SmartMallAssistantOrchestrator
from services.ai import ai_router

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Helper ────────────────────────────────────────────────────────────────────

def _assistant(db: Session, current_user: User) -> SmartMallAssistantOrchestrator:
    return SmartMallAssistantOrchestrator(db, current_user)


def _write_audit(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    tool_name: str | None = None,
    payload: dict | None = None,
    result: dict | None = None,
    provider_used: str | None = None,
    success: bool = True,
    error_message: str | None = None,
    ip_address: str | None = None,
) -> None:
    try:
        log = AuditLog(
            user_id=user_id,
            action=action,
            tool_name=tool_name,
            payload=payload,
            result=result,
            provider_used=provider_used,
            success=success,
            error_message=error_message,
            ip_address=ip_address,
        )
        db.add(log)
        db.commit()
    except Exception as exc:
        logger.warning("AuditLog write failed: %s", exc)


# ── Existing endpoints ─────────────────────────────────────────────────────────

@router.get("/status", response_model=AssistantStatusResponse)
def assistant_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _assistant(db, current_user).status()


@router.post("/chat", response_model=AssistantChatResponse)
@limiter.limit("45/minute")
def assistant_chat(
    request: Request,
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    response = _assistant(db, current_user).chat(payload)
    # Audit log every chat action
    if response.executed_actions:
        for action in response.executed_actions:
            _write_audit(
                db,
                user_id=current_user.id,
                action=action.action_id,
                payload={"message": payload.message[:500]},
                result=action.data if isinstance(action.data, dict) else {},
                provider_used=response.provider,
                success=True,
                ip_address=(request.client.host if request.client else None),
            )
    return response


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
    request: Request,
    lang: str = Query("en", pattern="^(ar|en)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = _assistant(db, current_user).execute_action(action_id, lang=lang)
        _write_audit(
            db,
            user_id=current_user.id,
            action=action_id,
            result=result.data if isinstance(result.data, dict) else {},
            success=True,
            ip_address=request.client.host if request.client else None,
        )
        return result
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


# ── NEW: Streaming SSE endpoint ────────────────────────────────────────────────

@router.post("/stream")
@limiter.limit("30/minute")
async def assistant_stream(
    request: Request,
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Server-Sent Events streaming chat endpoint.

    Emits:
      data: {"token": "word"}          — one token at a time
      data: {"done": true, ...}        — final chunk with metadata
      data: {"error": "..."}           — if streaming fails

    The frontend reads this with fetch() + ReadableStream.
    Falls back to Gemini automatically if OpenAI streaming fails.
    """
    lang = payload.lang or "en"
    user_message = (payload.message or "").strip()

    if not user_message:
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    # Input sanitisation — max 4000 chars
    user_message = user_message[:4000]

    # Build conversation context for the stream
    orchestrator = _assistant(db, current_user)
    snapshot = orchestrator._context.build_snapshot(lang=lang)
    system_prompt = (
        "You are SmartMall AI OS — an authoritative mall operations assistant. "
        f"Reply in {'Arabic' if lang == 'ar' else 'English'}. "
        "Use the mall snapshot data below to answer operational questions. "
        "Be concise and actionable.\n\n"
        f"Mall Snapshot:\n{json.dumps(snapshot.to_prompt_payload(), ensure_ascii=False)[:2000]}"
    )

    # Load recent conversation history
    conversation = orchestrator._memory.get_or_create_conversation(
        user_id=current_user.id,
        conversation_id=payload.conversation_id,
        initial_message=user_message,
    )
    orchestrator._memory.append_message(
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    history = orchestrator._history_for_provider(conversation.id)

    async def event_generator():
        full_response = []
        provider_used = "unknown"
        try:
            async for token, provider in ai_router.stream(
                messages=history,
                system_prompt=system_prompt,
            ):
                full_response.append(token)
                provider_used = provider
                yield f"data: {json.dumps({'token': token, 'provider': provider}, ensure_ascii=False)}\n\n"

            # Save assistant response to memory
            complete_text = "".join(full_response)
            orchestrator._memory.append_message(
                conversation_id=conversation.id,
                role="assistant",
                content=complete_text,
                payload={"provider": provider_used, "streamed": True},
            )

            # Final done event
            yield f"data: {json.dumps({'done': True, 'conversation_id': conversation.id, 'provider': provider_used, 'memory_entries': orchestrator._memory.message_count(conversation.id)}, ensure_ascii=False)}\n\n"

        except Exception as exc:
            logger.error("Streaming error: %s", exc)
            # Try to give a graceful degraded response
            yield f"data: {json.dumps({'error': str(exc), 'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── NEW: Provider health status ────────────────────────────────────────────────

@router.get("/provider-status")
def provider_status(
    current_user: User = Depends(get_current_user),
):
    """Return real-time health of OpenAI and Gemini providers."""
    return ai_router.provider_status()


# ── NEW: Audit logs ────────────────────────────────────────────────────────────

@router.get("/audit-logs")
def audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return paginated AI action audit log (admin only)."""
    if (current_user.role or "").strip().casefold() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = db.query(AuditLog).count()
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "tool_name": log.tool_name,
                "provider_used": log.provider_used,
                "success": log.success,
                "error_message": log.error_message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
