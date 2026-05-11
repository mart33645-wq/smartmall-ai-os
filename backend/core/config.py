import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def _split_origins(raw: str) -> List[str]:
    return [x.strip() for x in raw.split(",") if x.strip()]


def _default_sqlite_database_url() -> str:
    base_dir = Path(tempfile.gettempdir()) / "SmartMall AI OS"
    base_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{(base_dir / 'smartmall.db').as_posix()}"

@dataclass(frozen=True)
class GeminiSettings:
    api_key: str
    model: str
    base_url: str
    timeout_seconds: float
    memory_window: int
    temperature: float

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


@dataclass(frozen=True)
class OpenAISettings:
    api_key: str
    model: str
    base_url: str
    timeout_seconds: float

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


@dataclass(frozen=True)
class AppSettings:
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    cors_origins: List[str]
    database_url: str
    use_sqlite: bool
    smartmall_testing: bool
    sqlite_database_url: str
    default_postgres_url: str
    redis_url: str
    ai_automation_default: bool
    openai: OpenAISettings
    gemini: GeminiSettings

    @property
    def llm_enabled(self) -> bool:
        return self.openai.enabled or self.gemini.enabled

    @classmethod
    def from_env(cls) -> "AppSettings":
        return cls(
            secret_key=os.getenv("JWT_SECRET_KEY", "smartmall-dev-secret-change-in-production"),
            algorithm="HS256",
            access_token_expire_minutes=int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24))),
            cors_origins=_split_origins(
                os.getenv("CORS_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000"),
            ),
            database_url=os.getenv("DATABASE_URL", "").strip(),
            use_sqlite=os.getenv("USE_SQLITE", "").lower() in ("1", "true", "yes"),
            smartmall_testing=os.getenv("SMARTMALL_TESTING", "").lower() in ("1", "true", "yes"),
            sqlite_database_url=os.getenv("SQLITE_DATABASE_URL", _default_sqlite_database_url()),
            default_postgres_url="postgresql://user:password@localhost/smartmall",
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            ai_automation_default=os.getenv("AI_AUTOMATION_DEFAULT", "true").lower() in ("1", "true", "yes"),
            openai=OpenAISettings(
                api_key=os.getenv("OPENAI_API_KEY", "").strip(),
                model=os.getenv("OPENAI_MODEL", "gpt-5-mini").strip() or "gpt-5-mini",
                base_url=os.getenv("OPENAI_API_BASE_URL", "https://api.openai.com/v1").strip() or "https://api.openai.com/v1",
                timeout_seconds=float(os.getenv("OPENAI_TIMEOUT_SECONDS", "12")),
            ),
            gemini=GeminiSettings(
                api_key=os.getenv("GEMINI_API_KEY", "").strip(),
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash",
                base_url=os.getenv("GEMINI_API_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
                timeout_seconds=float(os.getenv("GEMINI_TIMEOUT_SECONDS", "15")),
                memory_window=max(4, int(os.getenv("GEMINI_MEMORY_WINDOW", "12"))),
                temperature=float(os.getenv("GEMINI_TEMPERATURE", "0.3")),
            ),
        )


settings = AppSettings.from_env()

SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes

CORS_ORIGINS = settings.cors_origins

DATABASE_URL = settings.database_url
USE_SQLITE = settings.use_sqlite
SMARTMALL_TESTING = settings.smartmall_testing
SQLITE_DATABASE_URL = settings.sqlite_database_url

DEFAULT_POSTGRES_URL = settings.default_postgres_url

REDIS_URL = settings.redis_url

OPENAI_API_KEY = settings.openai.api_key
OPENAI_MODEL = settings.openai.model
OPENAI_API_BASE_URL = settings.openai.base_url
OPENAI_TIMEOUT_SECONDS = settings.openai.timeout_seconds

GEMINI_API_KEY = settings.gemini.api_key
GEMINI_MODEL = settings.gemini.model
GEMINI_API_BASE_URL = settings.gemini.base_url
GEMINI_TIMEOUT_SECONDS = settings.gemini.timeout_seconds
GEMINI_MEMORY_WINDOW = settings.gemini.memory_window
GEMINI_TEMPERATURE = settings.gemini.temperature

AI_AUTOMATION_DEFAULT = settings.ai_automation_default
