from __future__ import annotations

from abc import ABC, abstractmethod
import datetime
import re

from sqlalchemy.orm import Session

from models.database import Shop, Task, ParkingSlot, Alert
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
        self._db = db
        self._lang = lang
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

    def execute_command_actions(self, message: str, actor_user_id: int | None = None) -> list[AssistantActionExecutionResult]:
        lowered = message.lower().strip()
        results: list[AssistantActionExecutionResult] = []

        if not lowered:
            return results

        # ── ADD SHOP ──────────────────────────────────────────────────────────
        if any(token in lowered for token in (
            "add shop", "create shop", "new shop", "open shop",
            "ضيف محل", "اضف محل", "افتح محل", "انشئ محل", "انشاء محل",
        )):
            shop_name = self._extract_shop_name(message)
            if shop_name:
                category = self._extract_category(message)
                floor = self._extract_floor(message)
                rent = self._extract_rent(message, default=5000)
                shop = Shop(
                    name=shop_name,
                    category=category,
                    floor=floor,
                    rent_amount=rent,
                    daily_revenue=0,
                    visitor_count=0,
                    performance_score=75,
                    owner_id=actor_user_id,
                )
                self._db.add(shop)
                self._db.commit()
                self._db.refresh(shop)
                results.append(AssistantActionExecutionResult(
                    action_id="direct_add_shop",
                    title="إضافة محل" if self._lang == "ar" else "Add shop",
                    summary=(
                        f"✅ تم إضافة المحل **{shop.name}** (الفئة: {shop.category}، الطابق {shop.floor}، الإيجار {shop.rent_amount:,.0f}) بنجاح."
                        if self._lang == "ar"
                        else f"✅ Shop **{shop.name}** added (Category: {shop.category}, Floor {shop.floor}, Rent {shop.rent_amount:,.0f})."
                    ),
                    affected_records=1,
                    data={"shop_id": shop.id, "shop_name": shop.name, "floor": floor, "rent": rent},
                ))

        # ── DELETE SHOP ───────────────────────────────────────────────────────
        elif any(token in lowered for token in (
            "delete shop", "remove shop", "close shop",
            "احذف محل", "امسح محل", "اغلق محل", "حذف محل",
        )):
            target = self._find_shop_from_message(message)
            if target:
                name = target.name
                self._db.delete(target)
                self._db.commit()
                results.append(AssistantActionExecutionResult(
                    action_id="direct_delete_shop",
                    title="حذف محل" if self._lang == "ar" else "Delete shop",
                    summary=(
                        f"🗑️ تم حذف المحل **{name}** من النظام."
                        if self._lang == "ar"
                        else f"🗑️ Shop **{name}** has been removed from the system."
                    ),
                    affected_records=1,
                    data={"shop_name": name},
                ))

        # ── RAISE RENT ────────────────────────────────────────────────────────
        if any(token in lowered for token in (
            "increase rent", "raise rent", "ارفع الايجار", "زيادة الايجار",
            "زود الايجار", "ارفع ايجار",
        )):
            target = self._find_shop_from_message(message)
            if target:
                pct = self._extract_percent(message, default=5)
                old_rent = target.rent_amount
                target.rent_amount = round(target.rent_amount * (1 + pct / 100), 2)
                self._db.commit()
                self._db.refresh(target)
                results.append(AssistantActionExecutionResult(
                    action_id="direct_raise_rent",
                    title="رفع الإيجار" if self._lang == "ar" else "Raise rent",
                    summary=(
                        f"📈 تم رفع إيجار **{target.name}** بنسبة {pct}% من {old_rent:,.0f} إلى {target.rent_amount:,.0f}."
                        if self._lang == "ar"
                        else f"📈 Raised **{target.name}** rent by {pct}% from {old_rent:,.0f} to {target.rent_amount:,.0f}."
                    ),
                    affected_records=1,
                    data={"shop_id": target.id, "old_rent": old_rent, "new_rent": target.rent_amount},
                ))

        # ── LOWER RENT ────────────────────────────────────────────────────────
        if any(token in lowered for token in (
            "decrease rent", "lower rent", "reduce rent", "خفض الايجار",
            "نزل الايجار", "قلل الايجار", "خصم الايجار",
        )):
            target = self._find_shop_from_message(message)
            if target:
                pct = self._extract_percent(message, default=5)
                old_rent = target.rent_amount
                target.rent_amount = round(target.rent_amount * (1 - pct / 100), 2)
                self._db.commit()
                self._db.refresh(target)
                results.append(AssistantActionExecutionResult(
                    action_id="direct_lower_rent",
                    title="خفض الإيجار" if self._lang == "ar" else "Lower rent",
                    summary=(
                        f"📉 تم خفض إيجار **{target.name}** بنسبة {pct}% من {old_rent:,.0f} إلى {target.rent_amount:,.0f}."
                        if self._lang == "ar"
                        else f"📉 Lowered **{target.name}** rent by {pct}% from {old_rent:,.0f} to {target.rent_amount:,.0f}."
                    ),
                    affected_records=1,
                    data={"shop_id": target.id, "old_rent": old_rent, "new_rent": target.rent_amount},
                ))

        # ── ADD TASK ──────────────────────────────────────────────────────────
        if any(token in lowered for token in (
            "add task", "create task", "new task",
            "ضيف مهمة", "اضف مهمة", "انشئ مهمة", "مهمة جديدة",
        )):
            title = self._extract_task_title(message)
            if title:
                priority = self._extract_priority(message)
                task = TaskManagementService(self._db).create_task({
                    "title": title,
                    "description": "",
                    "priority": priority,
                    "status": "Pending",
                    "assigned_to": actor_user_id,
                    "deadline": (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=7)).replace(tzinfo=None).isoformat(),
                })
                results.append(AssistantActionExecutionResult(
                    action_id="direct_add_task",
                    title="إضافة مهمة" if self._lang == "ar" else "Add task",
                    summary=(
                        f"✅ تم إنشاء المهمة: **{title}** (الأولوية: {priority})."
                        if self._lang == "ar"
                        else f"✅ Task created: **{title}** (Priority: {priority})."
                    ),
                    affected_records=1,
                    data={"task": task},
                ))

        # ── COMPLETE ALL TASKS ────────────────────────────────────────────────
        if any(token in lowered for token in (
            "complete all tasks", "finish all tasks",
            "اكمل كل المهام", "اتمم المهام", "خلص المهام",
        )):
            tasks = self._db.query(Task).filter(Task.status != "Completed").all()
            for t in tasks:
                t.status = "Completed"
            self._db.commit()
            results.append(AssistantActionExecutionResult(
                action_id="direct_complete_all_tasks",
                title="إكمال كل المهام" if self._lang == "ar" else "Complete all tasks",
                summary=(
                    f"✅ تم إكمال {len(tasks)} مهمة."
                    if self._lang == "ar"
                    else f"✅ Marked {len(tasks)} task(s) as completed."
                ),
                affected_records=len(tasks),
                data={"completed": len(tasks)},
            ))

        # ── START / RUN TASKS ─────────────────────────────────────────────────
        if any(token in lowered for token in (
            "run tasks", "start tasks", "نفذ المهام", "ابدأ المهام", "شغل المهام",
        )):
            pending = self._db.query(Task).filter(Task.status == "Pending").limit(10).all()
            for t in pending:
                t.status = "In Progress"
            self._db.commit()
            results.append(AssistantActionExecutionResult(
                action_id="direct_start_tasks",
                title="تشغيل المهام" if self._lang == "ar" else "Start tasks",
                summary=(
                    f"🚀 تم بدء تنفيذ {len(pending)} مهمة."
                    if self._lang == "ar"
                    else f"🚀 Started execution for {len(pending)} task(s)."
                ),
                affected_records=len(pending),
                data={"updated_tasks": len(pending)},
            ))

        # ── LIST SHOPS ────────────────────────────────────────────────────────
        if any(token in lowered for token in (
            "list shops", "show shops", "all shops",
            "اعرض المحلات", "اظهر المحلات", "كل المحلات",
        )):
            shops = self._db.query(Shop).all()
            shop_list = [{"id": s.id, "name": s.name, "floor": s.floor, "rent": s.rent_amount, "performance": s.performance_score} for s in shops]
            results.append(AssistantActionExecutionResult(
                action_id="direct_list_shops",
                title="قائمة المحلات" if self._lang == "ar" else "List shops",
                summary=(
                    f"📋 يوجد {len(shops)} محل في المنظومة."
                    if self._lang == "ar"
                    else f"📋 There are {len(shops)} shop(s) in the system."
                ),
                affected_records=len(shops),
                data={"shops": shop_list},
            ))

        # ── LIST TASKS ────────────────────────────────────────────────────────
        if any(token in lowered for token in (
            "list tasks", "show tasks", "all tasks",
            "اعرض المهام", "اظهر المهام", "كل المهام",
        )):
            tasks = self._db.query(Task).all()
            task_list = [{"id": t.id, "title": t.title, "status": t.status, "priority": t.priority} for t in tasks]
            results.append(AssistantActionExecutionResult(
                action_id="direct_list_tasks",
                title="قائمة المهام" if self._lang == "ar" else "List tasks",
                summary=(
                    f"📋 يوجد {len(tasks)} مهمة في النظام."
                    if self._lang == "ar"
                    else f"📋 There are {len(tasks)} task(s) in the system."
                ),
                affected_records=len(tasks),
                data={"tasks": task_list},
            ))

        # ── RESOLVE ALL ALERTS ────────────────────────────────────────────────
        if any(token in lowered for token in (
            "resolve alerts", "clear alerts", "dismiss alerts",
            "احل التنبيهات", "امسح التنبيهات", "حل التنبيهات",
        )):
            alerts = self._db.query(Alert).filter(Alert.is_resolved == False).all()
            for a in alerts:
                a.is_resolved = True
            self._db.commit()
            results.append(AssistantActionExecutionResult(
                action_id="direct_resolve_alerts",
                title="حل التنبيهات" if self._lang == "ar" else "Resolve alerts",
                summary=(
                    f"✅ تم حل {len(alerts)} تنبيه."
                    if self._lang == "ar"
                    else f"✅ Resolved {len(alerts)} alert(s)."
                ),
                affected_records=len(alerts),
                data={"resolved": len(alerts)},
            ))

        # ── FREE PARKING ──────────────────────────────────────────────────────
        if any(token in lowered for token in (
            "free parking", "clear parking", "empty parking",
            "فرغ المواقف", "افرغ المواقف", "خلي المواقف فاضية",
        )):
            slots = self._db.query(ParkingSlot).filter(ParkingSlot.is_occupied == True).all()
            for slot in slots:
                slot.is_occupied = False
            self._db.commit()
            results.append(AssistantActionExecutionResult(
                action_id="direct_free_parking",
                title="تفريغ المواقف" if self._lang == "ar" else "Free parking slots",
                summary=(
                    f"🅿️ تم تحرير {len(slots)} موقف."
                    if self._lang == "ar"
                    else f"🅿️ Freed {len(slots)} parking slot(s)."
                ),
                affected_records=len(slots),
                data={"freed": len(slots)},
            ))

        # ── RAISE ALL RENTS ───────────────────────────────────────────────────
        if any(token in lowered for token in (
            "raise all rents", "increase all rents",
            "ارفع كل الايجارات", "زود كل الايجارات",
        )):
            shops = self._db.query(Shop).all()
            pct = self._extract_percent(message, default=5)
            for s in shops:
                s.rent_amount = round(s.rent_amount * (1 + pct / 100), 2)
            self._db.commit()
            results.append(AssistantActionExecutionResult(
                action_id="direct_raise_all_rents",
                title="رفع كل الإيجارات" if self._lang == "ar" else "Raise all rents",
                summary=(
                    f"📈 تم رفع إيجارات {len(shops)} محل بنسبة {pct}%."
                    if self._lang == "ar"
                    else f"📈 Raised rents for {len(shops)} shop(s) by {pct}%."
                ),
                affected_records=len(shops),
                data={"affected": len(shops), "percent": pct},
            ))

        # ── LOWER ALL RENTS ───────────────────────────────────────────────────
        if any(token in lowered for token in (
            "lower all rents", "decrease all rents",
            "خفض كل الايجارات", "نزل كل الايجارات",
        )):
            shops = self._db.query(Shop).all()
            pct = self._extract_percent(message, default=5)
            for s in shops:
                s.rent_amount = round(s.rent_amount * (1 - pct / 100), 2)
            self._db.commit()
            results.append(AssistantActionExecutionResult(
                action_id="direct_lower_all_rents",
                title="خفض كل الإيجارات" if self._lang == "ar" else "Lower all rents",
                summary=(
                    f"📉 تم خفض إيجارات {len(shops)} محل بنسبة {pct}%."
                    if self._lang == "ar"
                    else f"📉 Lowered rents for {len(shops)} shop(s) by {pct}%."
                ),
                affected_records=len(shops),
                data={"affected": len(shops), "percent": pct},
            ))

        return results

    # ── HELPERS ────────────────────────────────────────────────────────────────

    def _extract_shop_name(self, message: str) -> str | None:
        patterns = [
            r"(?:add shop|create shop|new shop|open shop)\s+[:\-]?\s*(.+?)(?:\s+(?:floor|category|rent|طابق|فئة|ايجار)|$)",
            r"(?:ضيف محل|اضف محل|افتح محل|انشئ محل|انشاء محل)\s+[:\-]?\s*(.+?)(?:\s+(?:طابق|فئة|ايجار|floor|category|rent)|$)",
        ]
        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                value = match.group(1).strip(" :.-,")
                if value:
                    return value[:120]
        return None

    def _extract_task_title(self, message: str) -> str | None:
        patterns = [
            r"(?:add task|create task|new task)\s+[:\-]?\s*(.+?)(?:\s+(?:priority|deadline|أولوية)|$)",
            r"(?:ضيف مهمة|اضف مهمة|انشئ مهمة|مهمة جديدة)\s+[:\-]?\s*(.+?)(?:\s+(?:أولوية|موعد)|$)",
        ]
        for pattern in patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                value = match.group(1).strip(" :.-,")
                if value:
                    return value[:250]
        return None

    def _extract_percent(self, message: str, default: int = 5) -> int:
        match = re.search(r"(\d{1,2})\s*%", message)
        if not match:
            match = re.search(r"(\d{1,2})\s*(?:percent|بالمية|بالمئة)", message, re.IGNORECASE)
        if match:
            pct = int(match.group(1))
            return max(1, min(80, pct))
        return default

    def _extract_category(self, message: str) -> str:
        categories = {
            "food": "Food & Beverage", "restaurant": "Food & Beverage",
            "مطعم": "Food & Beverage", "طعام": "Food & Beverage", "اكل": "Food & Beverage",
            "fashion": "Fashion", "clothes": "Fashion",
            "ملابس": "Fashion", "موضة": "Fashion",
            "electronics": "Electronics", "tech": "Electronics",
            "الكترونيات": "Electronics", "تكنولوجيا": "Electronics",
            "pharmacy": "Pharmacy", "صيدلية": "Pharmacy",
            "entertainment": "Entertainment", "ترفيه": "Entertainment",
            "jewelry": "Jewelry", "مجوهرات": "Jewelry",
            "sports": "Sports", "رياضة": "Sports",
            "beauty": "Beauty & Wellness", "تجميل": "Beauty & Wellness",
            "kids": "Kids & Toys", "العاب": "Kids & Toys",
        }
        lowered = message.lower()
        for keyword, cat in categories.items():
            if keyword in lowered:
                return cat
        return "Other"

    def _extract_floor(self, message: str) -> int:
        match = re.search(r"(?:floor|طابق|الطابق)\s*(\d+)", message, re.IGNORECASE)
        if match:
            return max(1, min(10, int(match.group(1))))
        return 1

    def _extract_rent(self, message: str, default: float = 5000) -> float:
        match = re.search(r"(?:rent|ايجار|إيجار)\s*[:\-]?\s*(\d+(?:\.\d+)?)", message, re.IGNORECASE)
        if match:
            return max(100, float(match.group(1)))
        return default

    def _extract_priority(self, message: str) -> str:
        lowered = message.lower()
        if any(w in lowered for w in ("high", "urgent", "عالية", "عاجل", "مهم")):
            return "High"
        if any(w in lowered for w in ("low", "منخفضة", "بسيطة")):
            return "Low"
        return "Medium"

    def _find_shop_from_message(self, message: str) -> Shop | None:
        shops = self._db.query(Shop).all()
        lowered = message.lower()
        # Exact name match first
        for shop in shops:
            if shop.name and shop.name.lower() in lowered:
                return shop
        # Partial match
        for shop in shops:
            if shop.name:
                for word in shop.name.lower().split():
                    if len(word) > 3 and word in lowered:
                        return shop
        return None
