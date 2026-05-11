"""Vercel integration service — AI can trigger deploys and check status."""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_VERCEL_API = "https://api.vercel.com"


class VercelService:
    """
    Vercel REST API wrapper.
    Supports triggering deployments, polling status, reading logs.
    """

    def __init__(
        self,
        token: str,
        project_id: str,
        team_id: str = "",
        deploy_hook_url: str = "",
    ) -> None:
        self._token = token
        self._project_id = project_id
        self._team_id = team_id
        self._deploy_hook_url = deploy_hook_url

    @property
    def enabled(self) -> bool:
        return bool(self._token and self._project_id)

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    @property
    def _team_params(self) -> dict[str, str]:
        return {"teamId": self._team_id} if self._team_id else {}

    # ── Public API ────────────────────────────────────────────────────────────

    def trigger_deployment(self) -> dict[str, Any]:
        """
        Trigger a new deployment.
        Uses deploy hook URL if configured (simpler), otherwise uses Redeploy API.
        """
        if not self.enabled:
            return {"success": False, "error": "Vercel integration not configured"}

        try:
            if self._deploy_hook_url:
                return self._trigger_via_hook()
            return self._trigger_via_api()
        except Exception as exc:
            logger.error("Vercel deploy trigger failed: %s", exc)
            return {"success": False, "error": str(exc)}

    def get_deployment_status(self, deployment_id: str | None = None) -> dict[str, Any]:
        """Get status of the latest (or a specific) deployment."""
        if not self.enabled:
            return {"success": False, "error": "Vercel not configured"}
        try:
            if deployment_id:
                return self._get_single_deployment(deployment_id)
            return self._get_latest_deployment()
        except Exception as exc:
            logger.error("Vercel status check failed: %s", exc)
            return {"success": False, "error": str(exc)}

    def get_recent_deployments(self, limit: int = 5) -> list[dict[str, Any]]:
        """Return the most recent N deployments."""
        if not self.enabled:
            return []
        try:
            params = {**self._team_params, "projectId": self._project_id, "limit": str(limit)}
            resp = httpx.get(
                f"{_VERCEL_API}/v6/deployments",
                headers=self._headers,
                params=params,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                {
                    "id": d.get("uid"),
                    "url": d.get("url"),
                    "state": d.get("state"),
                    "created_at": d.get("createdAt"),
                    "ready_state": d.get("readyState"),
                }
                for d in data.get("deployments", [])
            ]
        except Exception as exc:
            logger.warning("Could not fetch Vercel deployments: %s", exc)
            return []

    def get_deployment_logs(self, deployment_id: str) -> list[str]:
        """Fetch build log lines for a deployment."""
        if not self.enabled:
            return []
        try:
            params = {**self._team_params}
            resp = httpx.get(
                f"{_VERCEL_API}/v3/deployments/{deployment_id}/events",
                headers=self._headers,
                params=params,
                timeout=15,
            )
            resp.raise_for_status()
            events = resp.json()
            return [
                e.get("text", "")
                for e in events
                if isinstance(e, dict) and e.get("text")
            ]
        except Exception as exc:
            logger.warning("Could not fetch deployment logs: %s", exc)
            return [f"Error fetching logs: {exc}"]

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "project_id": self._project_id,
            "has_token": bool(self._token),
            "has_hook": bool(self._deploy_hook_url),
        }

    # ── Private helpers ────────────────────────────────────────────────────────

    def _trigger_via_hook(self) -> dict[str, Any]:
        resp = httpx.post(self._deploy_hook_url, timeout=15)
        resp.raise_for_status()
        try:
            data = resp.json()
        except Exception:
            data = {}
        job = data.get("job") if isinstance(data.get("job"), dict) else {}
        return {
            "success": True,
            "method": "deploy_hook",
            "job_id": (job or {}).get("id"),
            "message": "Deployment triggered via hook",
        }

    def _trigger_via_api(self) -> dict[str, Any]:
        """Redeploy latest deployment via Vercel API."""
        # First get the latest deployment ID
        latest = self._get_latest_deployment()
        if not latest.get("success"):
            return latest
        deployment_id = latest.get("id")
        if not deployment_id:
            return {"success": False, "error": "No existing deployment found to redeploy"}

        params = {**self._team_params}
        resp = httpx.post(
            f"{_VERCEL_API}/v13/deployments",
            headers=self._headers,
            params=params,
            json={"deploymentId": deployment_id, "name": self._project_id},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "method": "api",
            "deployment_id": data.get("id"),
            "url": data.get("url"),
            "state": data.get("readyState"),
        }

    def _get_latest_deployment(self) -> dict[str, Any]:
        params = {**self._team_params, "projectId": self._project_id, "limit": "1"}
        resp = httpx.get(
            f"{_VERCEL_API}/v6/deployments",
            headers=self._headers,
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        deployments = data.get("deployments", [])
        if not deployments:
            return {"success": False, "error": "No deployments found"}
        d = deployments[0]
        return {
            "success": True,
            "id": d.get("uid"),
            "url": d.get("url"),
            "state": d.get("state"),
            "ready_state": d.get("readyState"),
            "created_at": d.get("createdAt"),
        }

    def _get_single_deployment(self, deployment_id: str) -> dict[str, Any]:
        params = {**self._team_params}
        resp = httpx.get(
            f"{_VERCEL_API}/v13/deployments/{deployment_id}",
            headers=self._headers,
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        d = resp.json()
        return {
            "success": True,
            "id": d.get("id"),
            "url": d.get("url"),
            "state": d.get("readyState"),
            "created_at": d.get("createdAt"),
        }
