from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def public_health():
    return {
        "mall_online": True,
        "status": "SmartMall AI OS public health check passed",
    }
