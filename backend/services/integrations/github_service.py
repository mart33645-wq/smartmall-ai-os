"""GitHub integration service — AI can commit, push, and create rollback commits."""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[3]  # SmartMall AI OS root


class GitHubService:
    """
    GitPython-based GitHub service.
    Falls back gracefully if gitpython is not installed or token not set.
    """

    def __init__(self, token: str, repo: str, branch: str = "main") -> None:
        self._token = token
        self._repo = repo
        self._branch = branch
        self._git = self._init_git()

    def _init_git(self):
        try:
            import git  # type: ignore
            return git.Repo(_REPO_ROOT, search_parent_directories=True)
        except Exception as exc:
            logger.warning("GitPython not available or repo not found: %s", exc)
            return None

    @property
    def enabled(self) -> bool:
        return bool(self._token and self._repo and self._git is not None)

    # ── Public API ────────────────────────────────────────────────────────────

    def commit_and_push(
        self,
        message: str,
        files: list[str] | None = None,
        push: bool = True,
    ) -> dict[str, Any]:
        """
        Stage files (or all changed files), commit with a message, and push.

        Args:
            message: Commit message (will be prefixed with [SmartMall AI])
            files:   Specific file paths to stage; if None, stages all changes
            push:    Whether to push to remote after committing

        Returns:
            dict with commit_sha, message, pushed, branch
        """
        if not self.enabled:
            return {"success": False, "error": "GitHub integration not configured"}

        try:
            repo = self._git

            # Stage files
            if files:
                for f in files:
                    repo.index.add([f])
            else:
                repo.git.add(A=True)

            # Check if there is anything to commit
            if not repo.index.diff("HEAD") and not repo.untracked_files:
                return {
                    "success": True,
                    "committed": False,
                    "message": "Nothing to commit — working tree clean",
                    "branch": self._branch,
                }

            full_message = f"[SmartMall AI] {message}"
            commit = repo.index.commit(full_message)

            pushed = False
            if push:
                self._push(repo)
                pushed = True

            logger.info("GitHub: committed %s and pushed=%s", commit.hexsha[:8], pushed)
            return {
                "success": True,
                "committed": True,
                "commit_sha": commit.hexsha,
                "short_sha": commit.hexsha[:8],
                "message": full_message,
                "branch": self._branch,
                "pushed": pushed,
            }

        except Exception as exc:
            logger.error("GitHub commit failed: %s", exc)
            return {"success": False, "error": str(exc)}

    def create_rollback_commit(self, reason: str) -> dict[str, Any]:
        """Create a revert commit to undo the last AI commit."""
        if not self.enabled:
            return {"success": False, "error": "GitHub integration not configured"}
        try:
            repo = self._git
            last_commit = repo.head.commit
            repo.git.revert(last_commit.hexsha, no_edit=True)
            self._push(repo)
            return {
                "success": True,
                "reverted_sha": last_commit.hexsha[:8],
                "reason": reason,
            }
        except Exception as exc:
            logger.error("GitHub rollback failed: %s", exc)
            return {"success": False, "error": str(exc)}

    def get_recent_commits(self, n: int = 5) -> list[dict[str, Any]]:
        """Return the last N commits as a list of dicts."""
        if not self.enabled:
            return []
        try:
            commits = list(self._git.iter_commits(self._branch, max_count=n))
            return [
                {
                    "sha": c.hexsha[:8],
                    "message": c.message.strip(),
                    "author": str(c.author),
                    "timestamp": c.committed_datetime.isoformat(),
                }
                for c in commits
            ]
        except Exception as exc:
            logger.warning("Could not fetch commits: %s", exc)
            return []

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "repo": self._repo,
            "branch": self._branch,
            "has_token": bool(self._token),
        }

    # ── Private helpers ────────────────────────────────────────────────────────

    def _push(self, repo) -> None:
        """Push to remote, injecting token into the URL."""
        remote_url = repo.remotes.origin.url
        if "github.com" in remote_url and self._token:
            # Inject token into HTTPS URL
            auth_url = remote_url.replace(
                "https://github.com/",
                f"https://{self._token}@github.com/",
            )
            repo.git.push(auth_url, self._branch)
        else:
            repo.remotes.origin.push(self._branch)
