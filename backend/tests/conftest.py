import os
import sys
from pathlib import Path

import pytest

# Ensure backend dir is import root
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

TEST_DB = Path(os.getenv("TEMP", str(ROOT))) / "smartmall_pytest.db"

os.environ["SMARTMALL_TESTING"] = "true"
os.environ["SQLITE_DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["DISABLE_EVENT_BUS"] = "true"
os.environ["OPENAI_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""


@pytest.fixture(scope="session", autouse=True)
def _clean_db_file():
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except OSError:
            pass
    yield
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except OSError:
            pass


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        yield c
