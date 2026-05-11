"""
Production WebSocket connection manager with graceful keepalive handling.
Broadcasts real-time events (parking updates, alerts, AI actions) to all
connected frontend clients.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connected. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass
        logger.info("WebSocket disconnected. Total: %d", len(self.active_connections))

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Broadcast a JSON message to all active connections, pruning dead ones."""
        text = json.dumps(message, ensure_ascii=False)
        dead: List[WebSocket] = []

        for connection in list(self.active_connections):
            try:
                await connection.send_text(text)
            except WebSocketDisconnect:
                dead.append(connection)
            except RuntimeError:
                # Connection already closed by client
                dead.append(connection)
            except Exception as exc:  # noqa: BLE001
                logger.debug("WebSocket send failed (%s) — pruning connection", exc)
                dead.append(connection)

        for ws in dead:
            self.disconnect(ws)

    async def send_to(self, websocket: WebSocket, message: Dict[str, Any]) -> None:
        """Send a message to a single specific connection."""
        try:
            await websocket.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as exc:  # noqa: BLE001
            logger.debug("Personal WS send failed: %s", exc)
            self.disconnect(websocket)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


manager = ConnectionManager()
