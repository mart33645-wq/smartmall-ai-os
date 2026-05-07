import type { AssistantChatResponse, AssistantStatus, AssistantSystemAnalysis } from './assistantApi';
import type { AnalyticsOverview, ParkingSlot, ParkingStats, Shop } from '../store/useStore';

export const demoShops: Shop[] = [
  { id: 1, name: 'Nova Fashion', category: 'Fashion', floor: 1, rent_amount: 9200, is_at_risk: false, daily_revenue: 6800, visitor_count: 540, performance_score: 88 },
  { id: 2, name: 'Tech Vault', category: 'Electronics', floor: 2, rent_amount: 11000, is_at_risk: false, daily_revenue: 7400, visitor_count: 610, performance_score: 91 },
  { id: 3, name: 'Arabica Hub', category: 'Dining', floor: 1, rent_amount: 7600, is_at_risk: false, daily_revenue: 5200, visitor_count: 700, performance_score: 84 },
  { id: 4, name: 'Play Orbit', category: 'Entertainment', floor: 3, rent_amount: 8500, is_at_risk: true, daily_revenue: 2900, visitor_count: 280, performance_score: 57 },
  { id: 5, name: 'Fresh Basket', category: 'Grocery', floor: 1, rent_amount: 9700, is_at_risk: false, daily_revenue: 6300, visitor_count: 820, performance_score: 86 },
];

export const demoAnalyticsOverview: AnalyticsOverview = {
  total_revenue: 28600,
  total_visitors: 2950,
  avg_performance: 81.2,
  shops_at_risk: 1,
  active_alerts: 2,
  parking_occupancy: 73,
  total_shops: demoShops.length,
};

export const demoRevenueChart = [
  { day: 'Mon', revenue: 23100 },
  { day: 'Tue', revenue: 24500 },
  { day: 'Wed', revenue: 25200 },
  { day: 'Thu', revenue: 26600 },
  { day: 'Fri', revenue: 28900 },
  { day: 'Sat', revenue: 33400 },
  { day: 'Sun', revenue: 31200 },
];

export const demoVisitorTrends = [
  { hour: '08:00', visitors: 220 },
  { hour: '10:00', visitors: 480 },
  { hour: '12:00', visitors: 760 },
  { hour: '14:00', visitors: 980 },
  { hour: '16:00', visitors: 1120 },
  { hour: '18:00', visitors: 1250 },
  { hour: '20:00', visitors: 1010 },
  { hour: '22:00', visitors: 620 },
];

export const demoShopPerformance = demoShops.map((shop) => ({
  name: shop.name,
  revenue: shop.daily_revenue,
  visitors: shop.visitor_count,
  score: shop.performance_score,
  is_at_risk: shop.is_at_risk,
}));

export const demoParkingSlots: ParkingSlot[] = Array.from({ length: 60 }, (_, index) => ({
  id: index + 1,
  slot_number: `P-${String(index + 1).padStart(3, '0')}`,
  level: Math.floor(index / 20) + 1,
  is_occupied: index % 4 !== 0,
  type: index % 10 === 0 ? 'EV' : index % 15 === 0 ? 'Disabled' : 'Standard',
}));

export const demoParkingStats: ParkingStats = {
  total: 60,
  occupied: demoParkingSlots.filter((slot) => slot.is_occupied).length,
  available: demoParkingSlots.filter((slot) => !slot.is_occupied).length,
  occupancy_pct: 73.3,
  ev_total: demoParkingSlots.filter((slot) => slot.type === 'EV').length,
  ev_occupied: demoParkingSlots.filter((slot) => slot.type === 'EV' && slot.is_occupied).length,
  prediction_next_hour: 78,
  status: 'STABLE',
};

export const demoTasks = [
  { id: 101, title: 'Inspect east gate cameras', priority: 'High', status: 'In Progress', assigned_to: 3, deadline: new Date(Date.now() + 3 * 3600_000).toISOString() },
  { id: 102, title: 'Reconcile parking sensor drift', priority: 'Medium', status: 'Pending', assigned_to: 2, deadline: new Date(Date.now() + 9 * 3600_000).toISOString() },
  { id: 103, title: 'Review top-risk shop strategy', priority: 'High', status: 'Pending', assigned_to: 1, deadline: new Date(Date.now() + 18 * 3600_000).toISOString() },
];

export const offlineAssistantStatus = (lang: 'ar' | 'en'): AssistantStatus => ({
  provider: lang === 'ar' ? 'المساعد المحلي' : 'Local assistant',
  model: lang === 'ar' ? 'وضع بدون خادم' : 'Offline mode',
  gemini_enabled: false,
  fallback_active: true,
});

export const offlineAssistantAnalysis = (lang: 'ar' | 'en'): AssistantSystemAnalysis => ({
  provider: 'offline',
  used_fallback: true,
  executive_summary:
    lang === 'ar'
      ? 'البيانات المعروضة تعمل الآن بوضع احتياطي كامل لضمان استمرار لوحة التحكم.'
      : 'The dashboard is currently running in full fallback mode to keep operations available.',
  key_metrics: {
    total_revenue: demoAnalyticsOverview.total_revenue,
    total_visitors: demoAnalyticsOverview.total_visitors,
    total_shops: demoAnalyticsOverview.total_shops,
    shops_at_risk: demoAnalyticsOverview.shops_at_risk,
    parking_occupancy: demoAnalyticsOverview.parking_occupancy,
    gemini_live: false,
  },
  modules: [
    { module: lang === 'ar' ? 'التحليلات' : 'Analytics', score: 92, summary: lang === 'ar' ? 'الرسومات تعمل ببيانات جاهزة.' : 'Charts are running with fallback data.' },
    { module: lang === 'ar' ? 'المواقف' : 'Parking', score: 89, summary: lang === 'ar' ? 'التوقعات متاحة مع نسب إشغال مستقرة.' : 'Predictions are available with stable occupancy.' },
    { module: lang === 'ar' ? 'المحلات' : 'Shops', score: 87, summary: lang === 'ar' ? 'بطاقات الأداء محملة بالكامل.' : 'Performance cards are fully populated.' },
  ],
  improvement_opportunities: [
    lang === 'ar' ? 'إعادة ربط الخادم للحصول على بيانات لحظية بالكامل.' : 'Reconnect backend for full live telemetry.',
    lang === 'ar' ? 'مزامنة المستخدم الافتراضي تلقائيًا بعد كل إعادة نشر.' : 'Auto-sync demo user after each deployment.',
  ],
  suggested_actions: [],
  generated_at: new Date().toISOString(),
});

export const offlineAssistantChat = (message: string, lang: 'ar' | 'en'): AssistantChatResponse => ({
  conversation_id: 'offline-conversation',
  provider: 'offline',
  used_fallback: true,
  answer:
    lang === 'ar'
      ? `تم استلام سؤالك: "${message}". النظام يعمل الآن بوضع احتياطي، وجميع اللوحات الأساسية (المحلات، المواقف، التحليلات) مفعلة ببيانات تشغيلية حتى رجوع الربط المباشر.`
      : `Received: "${message}". The app is currently in fallback mode, and all core modules (shops, parking, analytics) are active with operational data until live backend sync returns.`,
  analysis: [
    lang === 'ar' ? 'وضع الشات: احتياطي بدون خادم.' : 'Chat mode: offline fallback.',
    lang === 'ar' ? 'الوظائف الحرجة تعمل بدون صفحة لوجين.' : 'Critical flows run without a login page.',
  ],
  suggestions: [
    lang === 'ar' ? 'افتح التحليلات وراجع منحنى الزوار.' : 'Open analytics and review visitor trend.',
    lang === 'ar' ? 'راجع المحلات ذات المخاطر العالية.' : 'Review high-risk shops.',
  ],
  follow_up_questions: [
    lang === 'ar' ? 'ما أولويات الإصلاح لهذا الأسبوع؟' : 'What are this week priorities?',
  ],
  suggested_actions: [],
  executed_actions: [],
  memory_entries: 0,
  generated_at: new Date().toISOString(),
});
