from fastapi import APIRouter
from . import alerts, analytics, auth, parking, public, reports, segmentation, shops, simulation, tasks

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(shops.router, prefix="/shops", tags=["Shops Management"])
router.include_router(tasks.router, prefix="/tasks", tags=["Task Manager"])
router.include_router(parking.router, prefix="/parking", tags=["Smart Parking"])
router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
router.include_router(public.router, prefix="/public", tags=["Public"])
router.include_router(reports.router, prefix="/reports", tags=["Reports"])
router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
router.include_router(simulation.router, prefix="/simulation", tags=["Simulation"])
router.include_router(segmentation.router, prefix="/ai", tags=["Segmentation"])
