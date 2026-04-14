from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from core.config import CORS_ORIGINS
from core.db_utils import seed_database
from core.websocket_manager import manager
from models.database import Base, engine
from api import (
    ai_assistant,
    alerts,
    analytics,
    auth,
    gamification,
    monitoring,
    parking,
    public as public_api,
    reports,
    segmentation,
    shops,
    simulation,
    tasks,
)


def _sqlite_table_columns(conn, table: str) -> set[str]:
    res = conn.execute(text(f"PRAGMA table_info({table})"))
    return {row[1] for row in res.fetchall()}


def _sqlite_migrate_columns() -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            names = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
        except Exception:
            names = set()
        if "users" in names:
            cols = _sqlite_table_columns(conn, "users")
            if "preferences" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN preferences TEXT"))
                print("SQLite migration: added users.preferences")
        if "parking_slots" in names:
            cols = _sqlite_table_columns(conn, "parking_slots")
            if "level" not in cols:
                conn.execute(text("ALTER TABLE parking_slots ADD COLUMN level INTEGER DEFAULT 1"))
                print("SQLite migration: added parking_slots.level")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _sqlite_migrate_columns()
    seed_database()
    yield


app = FastAPI(title="SmartMall AI OS Enterprise", version="4.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(public_api.router, prefix="/api/public", tags=["Public / Customer"])
app.include_router(shops.router, prefix="/api/shops", tags=["Shop Management"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Task Manager"])
app.include_router(parking.router, prefix="/api/parking", tags=["Smart Parking"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(ai_assistant.router, prefix="/api/ai-assistant", tags=["AI Assistant"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(segmentation.router, prefix="/api/ai", tags=["AI Segmentation"])
app.include_router(gamification.router, prefix="/api/gamification", tags=["Gamification"])


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/")
async def root():
    return {"status": "SmartMall AI OS Enterprise v4.0 Online", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
