import { motion } from 'framer-motion';
import { Activity, Bot, Clock, DollarSign, Store, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { AppShell } from '../components/AppShell';
import { useLang } from '../i18n/LangContext';
import { formatCurrency, formatNumber, formatPercent, localizePriority, localizeTaskStatus } from '../i18n/format';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';

type RecentTask = {
  id: number;
  title: string;
  priority: string;
  status: string;
  deadline?: string;
};

type ParkingStatsLike = {
  total: number;
  occupied: number;
  available: number;
  occupancy_pct: number;
  ev_total: number;
  ev_occupied: number;
  prediction_next_hour: number;
  status: string;
};

const StatWidget = ({
  label,
  value,
  trend,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  icon: typeof Activity;
  tone: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass rounded-[2rem] border border-white/10 p-6"
  >
    <div className="mb-4 flex items-center gap-3">
      <div className={`rounded-2xl p-2.5 ${tone}`}>
        <Icon size={18} />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
    <p className="text-3xl font-black text-white">{value}</p>
    <p className="mt-2 text-sm text-slate-400">{trend}</p>
  </motion.div>
);

export default function Dashboard() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { shops, analytics, setShops, setAnalytics } = useStore();
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [parkingStats, setParkingStats] = useState<ParkingStatsLike | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [shopsResponse, analyticsResponse, tasksResponse, parkingResponse] = await Promise.all([
          api.get('/api/shops/'),
          api.get('/api/analytics/overview'),
          api.get('/api/tasks/').catch(() => ({ data: [] })),
          api.get('/api/parking/stats').catch(() => ({ data: null })),
        ]);

        setShops(shopsResponse.data);
        setAnalytics(analyticsResponse.data);
        setRecentTasks((tasksResponse.data as RecentTask[]).slice(0, 4));
        setParkingStats(parkingResponse.data as ParkingStatsLike | null);
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      }
    };

    void fetchAll();
  }, [setAnalytics, setShops]);

  const totalRevenue = analytics?.total_revenue ?? shops.reduce((sum, shop) => sum + (shop.daily_revenue || 0), 0);
  const totalVisitors = analytics?.total_visitors ?? shops.reduce((sum, shop) => sum + (shop.visitor_count || 0), 0);
  const shopsAtRisk = analytics?.shops_at_risk ?? shops.filter((shop) => shop.is_at_risk).length;
  const totalShops = analytics?.total_shops ?? shops.length;
  const forecastRevenue = Math.round(totalRevenue * (shopsAtRisk > 0 ? 1.04 : 1.08));

  const aiHighlights = [
    lang === 'ar'
      ? `يتوقع النظام إيرادًا يوميًا قريبًا من ${formatCurrency(forecastRevenue, lang)} إذا استمر الطلب الحالي.`
      : `Projected daily revenue is trending toward ${formatCurrency(forecastRevenue, lang)} if current demand holds.`,
    lang === 'ar'
      ? `${formatNumber(shopsAtRisk, lang)} محل يحتاج متابعة مباشرة لتقليل مخاطر التراجع التجاري.`
      : `${formatNumber(shopsAtRisk, lang)} shops need direct attention to reduce commercial risk.`,
    lang === 'ar'
      ? `إشغال المواقف قد يصل إلى ${formatPercent(parkingStats?.prediction_next_hour ?? 0, lang)} خلال الساعة القادمة.`
      : `Parking occupancy may reach ${formatPercent(parkingStats?.prediction_next_hour ?? 0, lang)} within the next hour.`,
  ];

  const assistantPrompts = [
    lang === 'ar' ? 'حلل أضعف نقطة في المشروع الآن.' : 'Analyze the weakest area in the project right now.',
    lang === 'ar' ? 'رتب المهام الحالية حسب الأولوية.' : 'Reprioritize the current task backlog.',
    lang === 'ar' ? 'اشرح لي أي مفهوم تقني أو تجاري ببساطة.' : 'Explain any technical or business concept simply.',
  ];

  const exportPdf = async () => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(lang === 'ar' ? 'جاري تجهيز التقرير...' : 'Generating report...');
    }

    try {
      const response = await api.get('/api/reports/export/pdf', {
        params: { lang },
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data);
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = lang === 'ar' ? 'smartmall-report-ar.pdf' : 'smartmall-report-en.pdf';
        anchor.click();
      }

      toast.success(
        lang === 'ar'
          ? 'تم تجهيز التقرير. يمكنك طباعته أو تنزيله.'
          : 'Report generated. You can now print or download it.',
      );
    } catch {
      if (newWindow) {
        newWindow.close();
      }
      toast.error(t('reportDownloadFailed'));
    }
  };

  return (
    <AppShell mainClassName="custom-scrollbar relative flex flex-col gap-8">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"
      >
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.35em] text-cyan-300">
            <Activity size={12} />
            {t('commandCenter')}
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white">
            {t('smartMallOS')} <span className="text-cyan-300">OS</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void exportPdf()}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200 transition hover:text-white"
          >
            <DollarSign size={16} />
            {t('intelligenceReport')}
          </button>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {t('systemsOnline')}
          </div>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatWidget
          icon={Users}
          label={t('todayVisitors')}
          value={formatNumber(totalVisitors, lang)}
          trend={lang === 'ar' ? 'متابعة مباشرة لحركة الزوار' : 'Live visitor flow'}
          tone="bg-cyan-500/10 text-cyan-200"
        />
        <StatWidget
          icon={Store}
          label={t('managedNodes')}
          value={formatNumber(totalShops, lang)}
          trend={lang === 'ar' ? `${formatNumber(shopsAtRisk, lang)} في خطر` : `${formatNumber(shopsAtRisk, lang)} at risk`}
          tone="bg-violet-500/10 text-violet-200"
        />
        <StatWidget
          icon={DollarSign}
          label={t('dailyRevenue')}
          value={formatCurrency(totalRevenue, lang)}
          trend={lang === 'ar' ? 'إيرادات حية من جميع المحلات' : 'Live revenue from all stores'}
          tone="bg-amber-500/10 text-amber-200"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_420px]">
        <section className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="glass rounded-[2rem] border border-white/10 p-6">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                <TrendingUp size={14} />
                {t('shopAiPortfolioSummary')}
              </div>
              <div className="space-y-3">
                {aiHighlights.map((highlight) => (
                  <div key={highlight} className="rounded-2xl border border-white/8 bg-white/4 p-4 text-sm leading-6 text-slate-300">
                    {highlight}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-[2rem] border border-white/10 p-6">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                <Clock size={14} />
                {t('activeTasks')}
              </div>
              <div className="space-y-3">
                {recentTasks.length ? (
                  recentTasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-white">{task.title}</p>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-bold text-slate-300">
                          {localizeTaskStatus(task.status, lang)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{localizePriority(task.priority, lang)}</span>
                        <span>{task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{t('noPendingTasks')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="glass rounded-[2rem] border border-white/10 p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
              <Store size={14} />
              {t('parkingOccupancy')}
            </div>
            {parkingStats ? (
              <>
                <div className="mb-3 flex items-end justify-between">
                  <p className="text-4xl font-black text-white">{formatPercent(parkingStats.occupancy_pct, lang)}</p>
                  <p className="text-sm text-slate-500">
                    {formatNumber(parkingStats.occupied, lang)}/{formatNumber(parkingStats.total, lang)}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                    style={{ width: `${parkingStats.occupancy_pct}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  {lang === 'ar'
                    ? `الذروة المتوقعة خلال ساعة: ${formatPercent(parkingStats.prediction_next_hour, lang)}`
                    : `Expected peak within one hour: ${formatPercent(parkingStats.prediction_next_hour, lang)}`}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                {lang === 'ar' ? 'لا توجد بيانات مواقف متاحة حاليًا.' : 'No parking data is available right now.'}
              </p>
            )}
          </div>
        </section>

        <aside className="glass rounded-[2rem] border border-white/10 p-6">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
            <Bot size={14} />
            {lang === 'ar' ? 'مساحة عمل المساعد' : 'Assistant workspace'}
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-500/8 p-4">
              <p className="text-sm font-bold text-white">
                {lang === 'ar' ? 'المساعد أصبح أذكى وأوسع' : 'The assistant is smarter and larger now'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {lang === 'ar'
                  ? 'يمكنه الرد على أسئلة المشروع والأسئلة العامة داخل مساحة عمل أكبر وأنظف.'
                  : 'It can answer project questions and general questions inside a larger, cleaner workspace.'}
              </p>
            </div>

            {assistantPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => navigate('/assistant', { state: { prompt } })}
                className="w-full rounded-[1.4rem] border border-white/8 bg-white/4 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/8"
              >
                {prompt}
              </button>
            ))}

            <button
              type="button"
              onClick={() => navigate('/assistant')}
              className="w-full rounded-[1.5rem] bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
            >
              {lang === 'ar' ? 'فتح مساحة المساعد' : 'Open assistant workspace'}
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
