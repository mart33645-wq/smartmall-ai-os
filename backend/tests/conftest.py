import os
import sys
from pathlib import Path

import pytest

# Ensure backend dir is import root
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ["SMARTMALL_TESTING"] = "true"
os.environ["SQLITE_DATABASE_URL"] = f"sqlite:///{ROOT / 'pytest_smartmall.db'}"
os.environ["DISABLE_EVENT_BUS"] = "true"


@pytest.fixture(scope="session", autouse=True)
def _clean_db_file():
    dbf = ROOT / "pytest_smartmall.db"
    if dbf.exists():
        try:
            dbf.unlink()
        except OSError:
            pass
    yield
    if dbf.exists():
        try:
            dbf.unlink()
        except OSError:
            pass


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        yield c
