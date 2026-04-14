import os
from typing import List


def _split_origins(raw: str) -> List[str]:
    return [x.strip() for x in raw.split(",") if x.strip()]


SECRET_KEY = os.getenv("JWT_SECRET_KEY", "smartmall-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24)))

CORS_ORIGINS = _split_origins(
    os.getenv("CORS_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000"),
)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
USE_SQLITE = os.getenv("USE_SQLITE", "").lower() in ("1", "true", "yes")
SMARTMALL_TESTING = os.getenv("SMARTMALL_TESTING", "").lower() in ("1", "true", "yes")
SQLITE_DATABASE_URL = os.getenv("SQLITE_DATABASE_URL", "sqlite:///./smartmall.db")

DEFAULT_POSTGRES_URL = "postgresql://user:password@localhost/smartmall"

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
