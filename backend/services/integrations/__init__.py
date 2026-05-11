"""Integrations package — GitHub and Vercel singletons wired from settings."""
from core.config import settings
from .github_service import GitHubService
from .vercel_service import VercelService

github = GitHubService(
    token=settings.github.token,
    repo=settings.github.repo,
    branch=settings.github.branch,
)

vercel = VercelService(
    token=settings.vercel.token,
    project_id=settings.vercel.project_id,
    team_id=settings.vercel.team_id,
    deploy_hook_url=settings.vercel.deploy_hook_url,
)

__all__ = ["github", "vercel", "GitHubService", "VercelService"]
