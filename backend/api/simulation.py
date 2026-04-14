from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.websocket_manager import manager
from models.database import User, get_db
from services.simulation_service import SimulationService

router = APIRouter()


@router.post("/run")
async def run_simulation(
    params: dict = Body(default={}),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Use the new simulation service
    result_data = SimulationService.run_simulation(db, params)
    
    # Broadcast simulation result as an alert
    await manager.broadcast({
        "type": "SIMULATION_COMPLETE",
        "message": f"Simulation outcome: ${result_data['projected_total']:,.2f}",
        "value": result_data['projected_total'],
        "insights": result_data['insights']
    })
    
    return {
        "status": "success",
        "result": result_data["projected_total"],
        "details": result_data,
    }
