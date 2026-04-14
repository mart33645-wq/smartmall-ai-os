import { BarChart2, TrendingUp, Users, DollarSign, Zap, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useState, useEffect } from 'react';
import { useLang } from '../i18n/LangContext';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

interface ChartPoint {
  day?: string;
  hour?: string;
  revenue?: number;
  visitors?: number;
  name?: string;
  value?: number;
}

interface TooltipPayloadEntry {
  color: string;
  value: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

interface ShopPerformanceEntry {
  name: string;
  revenue: number;
}

interface StatCardProps {
  icon: typeof DollarSign;
  label: string;
  value: string;
  change: string;
  color: string;
  index: number;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-3 shadow-2xl border border-white/10">
        <p className="text-slate-400 text-xs mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-bold text-sm" style={{ color: p.color }}>
            {p.value > 1000 ? `$${(p.value / 1000).toFixed(0)}k` : p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const StatCard = ({ icon: Icon, label, value, change, color, index }: StatCardProps) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}
    whileHover={{ y: -4, scale: 1.01 }}
    className="glass glass-hover rounded-2xl p-5">
    <div className="flex justify-between items-start mb-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <span className="flex items-center space-x-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
        <ArrowUpRight size={11} /><span>{change}</span>
      </span>
    </div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-2xl font-extrabold text-white mt-1">{value}</p>
  </motion.div>
);

const Analytics = () => {
  const { t } = useLang();
  const { analytics, setAnalytics } = useStore();
  const [revenueChart, setRevenueChart] = useState<ChartPoint[]>([]);
  const [visitorTrends, setVisitorTrends] = useState<ChartPoint[]>([]);
  const [shopPerf, setShopPerf] = useState<ShopPerformanceEntry[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [overviewRes, revenueRes, visitorsRes, shopPerfRes] = await Promise.all([
          api.get('/api/analytics/overview'),
          api.get('/api/analytics/revenue-chart'),
          api.get('/api/analytics/visitor-trends'),
          api.get('/api/analytics/shop-performance'),
        ]);
        setAnalytics(overviewRes.data);
        setRevenueChart(revenueRes.data);
        setVisitorTrends(visitorsRes.data);
        setShopPerf(shopPerfRes.data);
      } catch (e) {
        console.error('Analytics fetch error:', e);
      }
    };
    fetchAll();
  }, [setAnalytics]);

  const catData = shopPerf.map(s => ({ name: s.name, value: s.revenue })).slice(0, 5);

  return (
    <AppShell>
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">{t('analyticsTitle')}</h1>
          <p className="text-slate-500 mt-1 text-sm">{t('analyticsSub')}</p>
        </motion.header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard icon={DollarSign} label={t('dailyRevenue')} value={analytics ? `$${analytics.total_revenue.toLocaleString()}` : '—'} change="+14.2%" color="#6366f1" index={0} />
          <StatCard icon={Users} label={t('dailyVisitors')} value={analytics ? analytics.total_visitors.toLocaleString() : '—'} change="+8.5%" color="#8b5cf6" index={1} />
          <StatCard icon={TrendingUp} label={t('avgPerformance')} value={analytics ? `${analytics.avg_performance}%` : '—'} change="+3.1%" color="#10b981" index={2} />
          <StatCard icon={Zap} label={t('parkingOccupancy')} value={analytics ? `${analytics.parking_occupancy}%` : '—'} change="Live" color="#f59e0b" index={3} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart2 size={18} className="text-indigo-400" /> {t('revVsTarget')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{t('basedOnRealShopData')}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueChart} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-6">{t('revenueByShop')}</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                  dataKey="value" paddingAngle={4}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-4">
              {catData.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-xs text-slate-400 truncate max-w-[100px]">{c.name}</span>
                  </div>
                  <span className="text-xs font-bold text-white">${(c.value / 1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="glass rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
            <Users size={18} className="text-purple-400" /> {t('footTrafficByHour')}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={visitorTrends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="visitors" stroke="#8b5cf6" strokeWidth={2.5} dot={false} name="Visitors" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
    </AppShell>
  );
};

export default Analytics;
