from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class AssistantActionDescriptor:
    id: str
    title: str
    description: str
    safe_to_run: bool = True


@dataclass(slots=True)
class AssistantModuleAssessment:
    module: str
    score: int
    summary: str
    issue: str | None = None


@dataclass(slots=True)
class MallSnapshot:
    key_metrics: dict[str, Any]
    modules: list[AssistantModuleAssessment]
    improvement_opportunities: list[str]
    suggested_actions: list[AssistantActionDescriptor]
    shops_at_risk: list[dict[str, Any]]
    active_alerts: list[dict[str, Any]]
    pending_tasks: list[dict[str, Any]]
    parking: dict[str, Any]

    def to_prompt_payload(self) -> dict[str, Any]:
        return {
            "key_metrics": self.key_metrics,
            "modules": [
                {
                    "module": module.module,
                    "score": module.score,
                    "summary": module.summary,
                    "issue": module.issue,
                }
                for module in self.modules
            ],
            "improvement_opportunities": self.improvement_opportunities,
            "shops_at_risk": self.shops_at_risk,
            "active_alerts": self.active_alerts,
            "pending_tasks": self.pending_tasks,
            "parking": self.parking,
            "suggested_actions": [
                {
                    "id": action.id,
                    "title": action.title,
                    "description": action.description,
                    "safe_to_run": action.safe_to_run,
                }
                for action in self.suggested_actions
            ],
        }


@dataclass(slots=True)
class AssistantProviderResponse:
    answer: str
    analysis: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    follow_up_questions: list[str] = field(default_factory=list)
    action_ids: list[str] = field(default_factory=list)
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class AssistantActionExecutionResult:
    action_id: str
    title: str
    summary: str
    affected_records: int | None = None
    data: dict[str, Any] = field(default_factory=dict)
