from __future__ import annotations

from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from services.shop_management import ShopIntelligenceService
from services.task_management import TaskManagementService

from .context import MallContextService
from .models import AssistantActionDescriptor, AssistantActionExecutionResult


class AssistantAction(ABC):
    action_id: str
    safe_to_run: bool = True

    def __init__(self, db: Session, context_service: MallContextService, lang: str):
        self._db = db
        self._context_service = context_service
        self._lang = lang

    @property
    @abstractmethod
    def title(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def description(self) -> str:
        raise NotImplementedError

    @property
    def descriptor(self) -> AssistantActionDescriptor:
        return AssistantActionDescriptor(
            id=self.action_id,
            title=self.title,
            description=self.description,
            safe_to_run=self.safe_to_run,
        )

    @abstractmethod
    def execute(self) -> AssistantActionExecutionResult:
        raise NotImplementedError


class SummarizeOperationsAction(AssistantAction):
    action_id = "summarize_operations"

    @property
    def title(self) -> str:
        return "تلخيص العمليات" if self._lang == "ar" else "Summarize operations"

    @property
    def description(self) -> str:
        return (
            "إنشاء ملخص تشغيلي مباشر يشمل الإيرادات والمحلات والمهام والمواقف."
            if self._lang == "ar"
            else "Generate a fresh operational summary from live mall data."
        )

    def execute(self) -> AssistantActionExecutionResult:
        snapshot = self._context_service.build_snapshot(lang=self._lang)
        summary = (
            "تم إنشاء ملخص تشغيلي مباشر يغطي الإيرادات والمحلات والمهام والمواقف."
            if self._lang == "ar"
            else "Generated a live operations summary covering revenue, shops, tasks, and parking."
        )
        return AssistantActionExecutionResult(
            action_id=self.action_id,
            title=self.title,
            summary=summary,
            data={
                "key_metrics": snapshot.key_metrics,
                "improvement_opportunities": snapshot.improvement_opportunities,
            },
        )


class OptimizeTaskPrioritiesAction(AssistantAction):
    action_id = "optimize_task_priorities"

    @property
    def title(self) -> str:
        return "تحسين أولويات المهام" if self._lang == "ar" else "Optimize task priorities"

    @property
    def description(self) -> str:
        return (
            "إعادة تقييم المهام المعلقة بناءً على الأولوية والمواعيد والحمل التشغيلي."
            if self._lang == "ar"
            else "Re-score pending tasks using priority, deadlines, and operational context."
        )

    def execute(self) -> AssistantActionExecutionResult:
        result = TaskManagementService(self._db).optimize_priorities()
        summary = (
            f"تم تحديث أولويات {result['optimized']} مهمة اعتمادًا على الضغط التشغيلي الحالي."
            if self._lang == "ar"
            else f"Optimized {result['optimized']} task priority assignment(s)."
        )
        return AssistantActionExecutionResult(
            action_id=self.action_id,
            title=self.title,
            summary=summary,
            affected_records=result["optimized"],
            data={"tasks": result["tasks"][:8]},
        )


class RunShopRiskSweepAction(AssistantAction):
    action_id = "run_shop_risk_sweep"

    @property
    def title(self) -> str:
        return "فحص مخاطر المحلات" if self._lang == "ar" else "Run shop risk sweep"

    @property
    def description(self) -> str:
        return (
            "إعادة احتساب مؤشرات الخطر للمحلات استنادًا إلى الإيراد والأداء الحاليين."
            if self._lang == "ar"
            else "Recalculate shop risk flags using current revenue and performance data."
        )

    def execute(self) -> AssistantActionExecutionResult:
        result = ShopIntelligenceService(self._db).assess_all_shops()
        summary = (
            f"تم تحديث ذكاء المخاطر لـ {result['affected']} محل، ولا يزال {result['at_risk']} منها بحاجة إلى متابعة."
            if self._lang == "ar"
            else f"Updated risk intelligence for {result['affected']} shop(s); {result['at_risk']} shop(s) remain at risk."
        )
        return AssistantActionExecutionResult(
            action_id=self.action_id,
            title=self.title,
            summary=summary,
            affected_records=result["affected"],
            data={"shops": result["shops"][:8], "at_risk": result["at_risk"]},
        )


class GenerateReportAction(AssistantAction):
    action_id = "generate_performance_report"

    @property
    def title(self) -> str:
        return "استخراج تقرير الأداء" if self._lang == "ar" else "Generate performance report"

    @property
    def description(self) -> str:
        return (
            "استخراج تقرير مفصل للأداء بصيغة PDF وجاهز للطباعة والتنزيل."
            if self._lang == "ar"
            else "Generate a detailed PDF performance report ready for printing and downloading."
        )

    def execute(self) -> AssistantActionExecutionResult:
        summary = (
            "تم تجهيز التقرير المطلوب. استخدم زر تقرير الذكاء أعلى لوحة التحكم لطباعة الملف أو حفظه PDF."
            if self._lang == "ar"
            else "The report is ready. Use the Intelligence Report button at the top of the dashboard to print or save the PDF."
        )
        return AssistantActionExecutionResult(
            action_id=self.action_id,
            title=self.title,
            summary=summary,
            data={},
        )


class AssistantActionRegistry:
    def __init__(self, db: Session, context_service: MallContextService, lang: str):
        self._actions = {
            action.action_id: action
            for action in (
                SummarizeOperationsAction(db, context_service, lang),
                OptimizeTaskPrioritiesAction(db, context_service, lang),
                RunShopRiskSweepAction(db, context_service, lang),
                GenerateReportAction(db, context_service, lang),
            )
        }

    def descriptors(self) -> list[AssistantActionDescriptor]:
        return [action.descriptor for action in self._actions.values()]

    def exists(self, action_id: str) -> bool:
        return action_id in self._actions

    def execute(self, action_id: str) -> AssistantActionExecutionResult:
        action = self._actions.get(action_id)
        if not action:
            raise LookupError(f"Unknown assistant action: {action_id}")
        return action.execute()
