from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.db_utils import seed_database
from core.deps import get_current_user
from models.database import User, get_db, Base, engine
from services.integrations import github, vercel

router = APIRouter()

def _require_admin(user: User) -> None:
    if (user.role or "").strip().casefold() != "admin":
        raise HTTPException(status_code=403, detail="Only admins can perform this action")


@router.get("/integrations-status")
def integrations_status(current_user: User = Depends(get_current_user)):
    """GitHub / Vercel configuration and availability (admin only)."""
    _require_admin(current_user)
    return {
        "github": github.status(),
        "vercel": vercel.status(),
    }


@router.post("/reset-db")
def reset_db(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_admin(current_user)

    try:
        # Drop all and recreate
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        seed_database()
        return {"message": "Database reset and seeded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

@router.post("/seed-data")
def trigger_seed(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_admin(current_user)

    seed_database()
    return {"message": "Seed data added successfully"}
