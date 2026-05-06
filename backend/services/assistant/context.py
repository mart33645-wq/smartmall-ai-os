from __future__ import annotations

import datetime

from sqlalchemy.orm import Session

from core.config import settings
from models.database import Shop, Task
from services.parking_stats import build_parking_stats
from services.shop_management import ShopSerializer
from services.task_management import TaskSerializer

from .models import AssistantActionDescriptor, AssistantModuleAssessment, MallSnapshot


class MallContextService:
    def __init__(self, db: Session):
        self._db = db

    def build_snapshot(self, lang: str = "en") -> MallSnapshot:
        shops = self._db.query(Shop).all()
        tasks = self._db.query(Task).all()
        parking = build_parking_stats(self._db)

        total_revenue = round(sum(shop.daily_revenue for shop in shops), 2)
        total_visitors = sum(shop.visitor_count for shop in shops)
        at_risk = [shop for shop in shops if shop.is_at_risk]
        pending_tasks = [task for task in tasks if task.status != "Completed"]
        overdue_tasks = [
            task
            for task in pending_tasks
            if task.deadline and task.deadline < datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        ]
        avg_performance = (
            round(sum(shop.performance_score for shop in shops) / len(shops), 1)
            if shops
            else 0.0
        )

        key_metrics = {
            "total_revenue": total_revenue,
            "total_visitors": total_visitors,
            "total_shops": len(shops),
            "shops_at_risk": len(at_risk),
            "pending_tasks": len(pending_tasks),
            "overdue_tasks": len(overdue_tasks),
            "parking_occupancy": parking["occupancy_pct"],
            "avg_shop_performance": avg_performance,
            "gemini_live": settings.gemini.enabled,
        }

        modules = [
            self._score_retail_module(len(shops), len(at_risk), avg_performance, lang),
            self._score_operations_module(len(pending_tasks), len(overdue_tasks), lang),
            self._score_parking_module(parking["occupancy_pct"], lang),
            self._score_ai_module(settings.gemini.enabled, lang),
        ]
        opportunities = self._build_opportunities(key_metrics, at_risk, lang)
        suggested_actions = self._build_suggested_actions(key_metrics, at_risk, lang)

        return MallSnapshot(
            key_metrics=key_metrics,
            modules=modules,
            improvement_opportunities=opportunities,
            suggested_actions=suggested_actions,
            shops_at_risk=[ShopSerializer.to_dict(shop) for shop in at_risk[:5]],
            active_alerts=[],
            pending_tasks=[TaskSerializer.to_dict(task) for task in pending_tasks[:5]],
            parking=parking,
        )

    def _score_retail_module(
        self,
        total_shops: int,
        at_risk_shops: int,
        avg_performance: float,
        lang: str,
    ) -> AssistantModuleAssessment:
        if total_shops == 0:
            return AssistantModuleAssessment(
                module="أداء المحلات" if lang == "ar" else "Retail performance",
                score=45,
                summary=(
                    "لا توجد بيانات محلات متاحة بعد."
                    if lang == "ar"
                    else "No shop data is available yet."
                ),
                issue=(
                    "أضف المحلات أولًا لتفعيل التحليل التجاري الذكي."
                    if lang == "ar"
                    else "Add shops first to unlock retail intelligence."
                ),
            )

        risk_penalty = round((at_risk_shops / max(total_shops, 1)) * 30)
        score = max(40, min(98, round(avg_performance) - risk_penalty))
        issue = None
        if at_risk_shops:
            issue = (
                f"{at_risk_shops} محل يحتاج إلى خطة احتفاظ ومراجعة تسعير."
                if lang == "ar"
                else f"{at_risk_shops} shop(s) need retention and pricing review."
            )

        return AssistantModuleAssessment(
            module="أداء المحلات" if lang == "ar" else "Retail performance",
            score=score,
            summary=(
                f"يتم تتبع {total_shops} محل بمتوسط أداء {avg_performance}%."
                if lang == "ar"
                else f"{total_shops} shops are tracked with an average performance score of {avg_performance}%."
            ),
            issue=issue,
        )

    def _score_operations_module(
        self,
        pending_tasks: int,
        overdue_tasks: int,
        lang: str,
    ) -> AssistantModuleAssessment:
        score = max(38, 92 - (pending_tasks * 3) - (overdue_tasks * 8))
        issue = None
        if overdue_tasks:
            issue = (
                f"هناك {overdue_tasks} مهمة متأخرة وتحتاج إلى إعادة ترتيب فوري."
                if lang == "ar"
                else f"{overdue_tasks} task(s) are overdue and should be reprioritized."
            )
        elif pending_tasks > 6:
            issue = (
                "قائمة المهام بدأت تتضخم وتستفيد من ترتيب ذكي للأولويات."
                if lang == "ar"
                else "The task backlog is growing and would benefit from AI priority optimization."
            )

        return AssistantModuleAssessment(
            module="سير العمل التشغيلي" if lang == "ar" else "Operations workflow",
            score=score,
            summary=(
                f"هناك {pending_tasks} مهمة نشطة داخل مسار العمليات."
                if lang == "ar"
                else f"{pending_tasks} active task(s) are in the operations queue."
            ),
            issue=issue,
        )

    def _score_parking_module(self, occupancy_pct: float, lang: str) -> AssistantModuleAssessment:
        score = max(42, 97 - max(0, round(occupancy_pct) - 55))
        issue = None
        if occupancy_pct >= 85:
            issue = (
                "المواقف تقترب من الذروة ويجب تفعيل التوجيه البديل فورًا."
                if lang == "ar"
                else "Parking is nearing peak capacity and overflow routing should be enabled."
            )
        elif occupancy_pct >= 70:
            issue = (
                "الطلب يرتفع في المواقف؛ يفضل متابعة اللوحات الإرشادية وخدمة صف السيارات."
                if lang == "ar"
                else "Parking demand is rising; monitor signage and valet operations."
            )

        return AssistantModuleAssessment(
            module="أتمتة المواقف" if lang == "ar" else "Parking automation",
            score=score,
            summary=(
                f"نسبة إشغال المواقف الحالية هي {occupancy_pct}%."
                if lang == "ar"
                else f"Current parking occupancy is {occupancy_pct}%."
            ),
            issue=issue,
        )

    def _score_ai_module(self, gemini_enabled: bool, lang: str) -> AssistantModuleAssessment:
        if gemini_enabled:
            return AssistantModuleAssessment(
                module="المساعد الذكي" if lang == "ar" else "AI copilot",
                score=95,
                summary=(
                    "المساعد الذكي مفعّل ويستطيع الرد على الأسئلة التشغيلية والعامة."
                    if lang == "ar"
                    else "The AI copilot is live and can answer operational and general questions."
                ),
            )

        return AssistantModuleAssessment(
            module="المساعد الذكي" if lang == "ar" else "AI copilot",
            score=68,
            summary=(
                "المساعد يعمل بوضع احتياطي حتى يتم إعداد Gemini."
                if lang == "ar"
                else "Fallback intelligence is active until Gemini is configured."
            ),
            issue=(
                "اضبط GEMINI_API_KEY للحصول على إجابات أعمق وأكثر مرونة."
                if lang == "ar"
                else "Set GEMINI_API_KEY for deeper and more flexible answers."
            ),
        )

    def _build_opportunities(
        self,
        key_metrics: dict[str, float | int | bool],
        at_risk: list[Shop],
        lang: str,
    ) -> list[str]:
        opportunities: list[str] = []

        if at_risk:
            opportunities.append(
                f"نفّذ فحص مخاطر وخطة احتفاظ موجهة لعدد {len(at_risk)} من المحلات."
                if lang == "ar"
                else f"Run a risk sweep and retention plan for {len(at_risk)} at-risk shop(s)."
            )
        if key_metrics["overdue_tasks"]:
            opportunities.append(
                f"أعد ترتيب {key_metrics['pending_tasks']} مهمة نشطة لتقليل التراكم التشغيلي."
                if lang == "ar"
                else f"Auto-prioritize {key_metrics['pending_tasks']} active task(s) to reduce the operations backlog."
            )
        if key_metrics["parking_occupancy"] >= 80:
            opportunities.append(
                "فعّل التوجيه البديل للمواقف وحدّث اللوحات الإرشادية قبل الذروة القادمة."
                if lang == "ar"
                else "Enable overflow parking guidance before the next traffic peak."
            )
        if not key_metrics["gemini_live"]:
            opportunities.append(
                "فعّل Gemini بدل الوضع الاحتياطي ليجيب المساعد عن الأسئلة العامة والمعقدة بشكل أفضل."
                if lang == "ar"
                else "Configure Gemini so the assistant can answer broader and more complex questions."
            )
        if not opportunities:
            opportunities.append(
                "الوحدات الأساسية مستقرة؛ ركّز على الأتمتة الاستباقية والتحسين التنبؤي."
                if lang == "ar"
                else "Core modules are healthy; focus on proactive automation and predictive optimization."
            )
        return opportunities

    def _build_suggested_actions(
        self,
        key_metrics: dict[str, float | int | bool],
        at_risk: list[Shop],
        lang: str,
    ) -> list[AssistantActionDescriptor]:
        actions = [
            AssistantActionDescriptor(
                id="summarize_operations",
                title="تلخيص العمليات" if lang == "ar" else "Summarize operations",
                description=(
                    "إنشاء لقطة تشغيلية ذكية تشمل المحلات والمهام والمواقف والإيرادات."
                    if lang == "ar"
                    else "Generate an AI-ready snapshot of revenue, shops, tasks, and parking."
                ),
            )
        ]

        if key_metrics["pending_tasks"]:
            actions.append(
                AssistantActionDescriptor(
                    id="optimize_task_priorities",
                    title="تحسين أولويات المهام" if lang == "ar" else "Optimize task priorities",
                    description=(
                        "إعادة تقييم المهام المعلقة باستخدام المواعيد والأولوية والحمل التشغيلي."
                        if lang == "ar"
                        else "Re-score pending tasks using deadlines, priority, and operational urgency."
                    ),
                )
            )
        if at_risk:
            actions.append(
                AssistantActionDescriptor(
                    id="run_shop_risk_sweep",
                    title="فحص مخاطر المحلات" if lang == "ar" else "Run shop risk sweep",
                    description=(
                        "إعادة احتساب علامات الخطر للمحلات اعتمادًا على الإيراد والأداء الحاليين."
                        if lang == "ar"
                        else "Recalculate shop risk flags based on revenue and performance."
                    ),
                )
            )

        actions.append(
            AssistantActionDescriptor(
                id="generate_performance_report",
                title="استخراج تقرير الأداء" if lang == "ar" else "Generate performance report",
                description=(
                    "تجهيز تقرير أداء قابل للطباعة أو الحفظ PDF."
                    if lang == "ar"
                    else "Prepare a performance report ready to print or save as PDF."
                ),
            )
        )
        return actions
