from fastapi import BackgroundTasks

from core.websocket_manager import manager


async def push_ws(payload: dict) -> None:
    await manager.broadcast(payload)


def schedule_ws(background_tasks: BackgroundTasks, payload: dict) -> None:
    background_tasks.add_task(push_ws, payload)
