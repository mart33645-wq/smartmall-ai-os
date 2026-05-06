import { BarChart2, DollarSign, TrendingUp, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState, useEffect } from 'react';

import { AppShell } from '../components/AppShell';
import { useLang } from '../i18n/LangContext';
import { formatCurrency, formatNumber, formatPercent } from '../i18n/format';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';

const COLORS = ['#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];

interface ChartPoint {
  day?: string;
  hour?: string;
  revenue?: number;
  visitors?: number;
  name?: string;
  value?: number;
}

interface ShopPerformanceEntry {
  name: string;
  revenue: number;
  visitors: number;
  score: number;
  is_at_risk: boolean;
}

const dayLabels: Record<string, { ar: string; en: string }> = {
  Mon: { ar: 'الإثنين', en: 'Mon' },
  Tue: { ar: 'الثلاثاء', en: 'Tue' },
  Wed: { ar: 'الأربعاء', en: 'Wed' },
  Thu: { ar: 'الخميس', en: 'Thu' },
  Fri: { ar: 'الجمعة', en: 'Fri' },
  Sat: { ar: 'السبت', en: 'Sat' },
  Sun: { ar: 'الأحد', en: 'Sun' },
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  change,
  color,
  index,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  change: string;
  color: string;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08 }}
    className="glass rounded-[1.8rem] border border-white/10 p-5"
  >
    <div className="mb-4 flex items-start justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}15`, border: `1px solid ${color}35` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-200">
        {change}
      </span>
    </div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-black text-white">{value}</p>
  </motion.div>
);

const CustomTooltip = ({
  active,
  payload,
  label,
  lang,
}: {
  active?: boolean;
  payload?: Array<{ color: string; value: number }>;
  label?: string;
  lang: 'ar' | 'en';
}) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/95 p-3 text-xs shadow-2xl">
      <p className="mb-2 text-slate-400">{label}</p>
      {payload.map((item, index) => (
        <p key={index} className="font-bold" style={{ color: item.color }}>
          {item.value > 1000 ? formatCurrency(item.value, lang) : formatNumber(item.value, lang)}
        </p>
      ))}
    </div>
  );
};

const Analytics = () => {
  const { t, lang } = useLang();
  const { analytics, setAnalytics } = useStore();
  const [revenueChart, setRevenueChart] = useState<ChartPoint[]>([]);
  const [visitorTrends, setVisitorTrends] = useState<ChartPoint[]>([]);
  const [shopPerf, setShopPerf] = useState<ShopPerformanceEntry[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [overviewResponse, revenueResponse, visitorsResponse, performanceResponse] = await Promise.all([
          api.get('/api/analytics/overview'),
          api.get('/api/analytics/revenue-chart'),
          api.get('/api/analytics/visitor-trends'),
          api.get('/api/analytics/shop-performance'),
        ]);

        setAnalytics(overviewResponse.data);
        setRevenueChart(revenueResponse.data);
        setVisitorTrends(visitorsResponse.data);
        setShopPerf(performanceResponse.data);
      } catch (error) {
        console.error('Analytics fetch error:', error);
      }
    };

    void fetchAll();
  }, [setAnalytics]);

  const localizedRevenueChart = revenueChart.map((point) => ({
    ...point,
    day: point.day ? dayLabels[point.day]?.[lang] || point.day : point.day,
  }));

  const topFive = shopPerf.slice(0, 5).map((shop) => ({ name: shop.name, value: shop.revenue }));
  const forecastRevenue = Math.round((analytics?.total_revenue ?? 0) * 1.07);
  const riskHotspot = shopPerf.find((shop) => shop.is_at_risk);
  const bestTrafficShop = [...shopPerf].sort((a, b) => b.visitors - a.visitors)[0];

  return (
    <AppShell>
      <motion.header initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{t('analyticsTitle')}</h1>
        <p className="mt-2 text-sm text-slate-400">{t('analyticsSub')}</p>
      </motion.header>

      <div className="mb-8 grid grid-cols-2 gap-5 xl:grid-cols-4">
        <StatCard icon={DollarSign} label={t('dailyRevenue')} value={analytics ? formatCurrency(analytics.total_revenue, lang) : '-'} change="+14.2%" color="#06b6d4" index={0} />
        <StatCard icon={Users} label={t('dailyVisitors')} value={analytics ? formatNumber(analytics.total_visitors, lang) : '-'} change="+8.5%" color="#6366f1" index={1} />
        <StatCard icon={TrendingUp} label={t('avgPerformance')} value={analytics ? formatPercent(analytics.avg_performance, lang) : '-'} change="+3.1%" color="#10b981" index={2} />
        <StatCard icon={Zap} label={t('parkingOccupancy')} value={analytics ? formatPercent(analytics.parking_occupancy, lang) : '-'} change={t('liveFeedLabel')} color="#f59e0b" index={3} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <motion.section initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-[2rem] border border-white/10 p-6">
          <div className="mb-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-white">
              <BarChart2 size={18} className="text-cyan-300" />
              {t('revVsTarget')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t('basedOnRealShopData')}</p>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={localizedRevenueChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip lang={lang} />} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              <Bar dataKey="revenue" fill="#06b6d4" radius={[8, 8, 0, 0]} name={t('dailyRevenue')} />
            </BarChart>
          </ResponsiveContainer>
        </motion.section>

        <motion.aside initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-[2rem] border border-white/10 p-6">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
            <TrendingUp size={14} />
            {t('aiSuggestion')}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <p className="text-xs text-slate-500">{t('projectedRevenue')}</p>
              <p className="mt-2 text-2xl font-black text-white">{formatCurrency(forecastRevenue, lang)}</p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <p className="text-xs text-slate-500">{lang === 'ar' ? 'أعلى محل من حيث الحركة' : 'Highest traffic shop'}</p>
              <p className="mt-2 text-lg font-black text-emerald-300">{bestTrafficShop?.name || '-'}</p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <p className="text-xs text-slate-500">{lang === 'ar' ? 'بؤرة الخطر الحالية' : 'Current risk hotspot'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {riskHotspot
                  ? lang === 'ar'
                    ? `${riskHotspot.name} يحتاج معالجة عاجلة لأن الأداء عند ${formatPercent(riskHotspot.score, lang)} مع خطر تجاري قائم.`
                    : `${riskHotspot.name} needs urgent action because performance is at ${formatPercent(riskHotspot.score, lang)} with active commercial risk.`
                  : lang === 'ar'
                    ? 'لا توجد بؤرة خطر حرجة حاليًا.'
                    : 'There is no critical risk hotspot right now.'}
              </p>
            </div>
          </div>
        </motion.aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[2rem] border border-white/10 p-6">
          <h2 className="mb-5 text-lg font-black text-white">{t('revenueByShop')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={topFive} dataKey="value" innerRadius={54} outerRadius={80} paddingAngle={4}>
                {topFive.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip lang={lang} />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            {topFive.map((shop, index) => (
              <div key={shop.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-slate-300">{shop.name}</span>
                </div>
                <span className="font-bold text-white">{formatCurrency(shop.value, lang)}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[2rem] border border-white/10 p-6">
          <h2 className="mb-5 text-lg font-black text-white">{t('footTrafficByHour')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={visitorTrends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip lang={lang} />} />
              <Line type="monotone" dataKey="visitors" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/4 p-4 text-sm leading-6 text-slate-300">
            {lang === 'ar'
              ? 'يشير منحنى الحركة إلى نافذة ذروة تحتاج إلى تجهيز طاقم إضافي وخط دفع أسرع قبل الوصول إلى أعلى مستوى.'
              : 'The traffic curve points to a peak window that should be supported with additional staffing and faster checkout flow.'}
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
};

export default Analytics;
