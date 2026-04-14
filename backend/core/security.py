"""Compatibility shim — use `core.deps` for JWT dependencies."""

from core.config import ALGORITHM, SECRET_KEY  # noqa: F401
from core.deps import get_current_user, oauth2_scheme  # noqa: F401
