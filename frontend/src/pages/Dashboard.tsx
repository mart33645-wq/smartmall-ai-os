import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Users, Zap, Shield,
  TrendingUp, AlertTriangle, DollarSign, Store, Cpu
} from 'lucide-react';
import { DigitalTwin } from '../components/DigitalTwin';
import { AIAssistantWidget } from '../components/AIAssistantWidget';
import { GamificationWidget } from '../components/GamificationWidget';
import SimulationModal from '../components/SimulationModal';
import { useStore } from '../store/useStore';
import { useLang } from '../i18n/LangContext';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

type AccentColor = 'indigo' | 'violet' | 'amber' | 'sky';

interface StatWidgetProps {
  icon: typeof Activity;
  label: string;
  value: string | number;
  trend: string;
  trendPositive?: boolean;
  color: AccentColor;
}

const colorClasses: Record<AccentColor, { text: string; bg: string }> = {
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/10' },
};

const StatWidget = ({ icon: Icon, label, value, trend, trendPositive, color }: StatWidgetProps) => {
  const palette = colorClasses[color];

  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass p-6 rounded-[2rem] border border-white/10 relative overflow-hidden group hover:scale-[1.02] transition-transform"
  >
    <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity ${palette.text}`}>
      <Icon size={48} />
    </div>
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2.5 rounded-xl ${palette.bg} ${palette.text}`}>
        <Icon size={20} />
      </div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">{label}</h3>
    </div>
    <div className="flex items-end justify-between">
      <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
      <div className={`text-xs font-bold ${trendPositive !== false ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-1`}>
        <TrendingUp size={12} className={trendPositive === false ? 'rotate-180' : ''} />
        {trend}
      </div>
    </div>
  </motion.div>
  );
};

export default function Dashboard() {
  const { t } = useLang();
  const { shops, alerts, analytics, setShops, setAlerts, setAnalytics } = useStore();
  const [isSimOpen, setIsSimOpen] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [shopRes, alertRes, analyticsRes] = await Promise.all([
          api.get('/api/shops'),
          api.get('/api/alerts'),
          api.get('/api/analytics/overview'),
        ]);
        setShops(shopRes.data);
        setAlerts(alertRes.data);
        setAnalytics(analyticsRes.data);
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      }
    };
    fetchAll();
  }, [setAlerts, setAnalytics, setShops]);

  const totalRevenue = analytics?.total_revenue ?? shops.reduce((acc, s) => acc + (s.daily_revenue || 0), 0);
  const totalVisitors = analytics?.total_visitors ?? shops.reduce((acc, s) => acc + (s.visitor_count || 0), 0);
  const activeAlerts = analytics?.active_alerts ?? alerts.filter(a => !a.is_resolved).length;
  const shopsAtRisk = analytics?.shops_at_risk ?? shops.filter(s => s.is_at_risk).length;
  const totalShopsLimit = analytics?.total_shops ?? shops.length;

  const unresolvedAlerts = alerts.filter(a => !a.is_resolved).slice(0, 4);

  const exportPdf = async () => {
    try {
      const res = await api.get('/api/reports/export/pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SmartMall_Performance_Report.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Could not export PDF');
    }
  };

  return (
    <AppShell mainClassName="custom-scrollbar relative flex flex-col gap-8 font-inter">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-end"
        >
          <div>
            <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] tracking-[0.4em] mb-2 uppercase">
              <Activity size={12} />
              Command Center
            </div>
            <h1 className="text-6xl font-black tracking-tighter">
              {t('smartMallOS')} <span className="text-indigo-500">OS</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={exportPdf}
              className="px-6 py-3 rounded-2xl glass border border-white/5 hover:bg-white/5 text-sm font-bold flex items-center gap-2 transition-all"
            >
              <DollarSign size={16} />
              Intelligence Report
            </button>
            <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center gap-3">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
              Systems Online
            </div>
          </div>
        </motion.header>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatWidget icon={Users} label={t('todayVisitors')} value={totalVisitors.toLocaleString()} trend={analytics ? 'Live feed' : '—'} trendPositive color="indigo" />
          <StatWidget icon={Store} label="Managed Nodes" value={totalShopsLimit} trend={`${shopsAtRisk} at risk`} trendPositive={shopsAtRisk === 0} color="violet" />
          <StatWidget icon={DollarSign} label={t('dailyRevenue')} value={`$${totalRevenue.toLocaleString()}`} trend={analytics ? 'Synced' : '—'} trendPositive color="amber" />
          <StatWidget icon={Shield} label={t('activeAlerts')} value={activeAlerts} trend={activeAlerts > 2 ? 'Action' : 'Secure'} trendPositive={activeAlerts <= 2} color="sky" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Middle: Visualization & Ops */}
          <div className="xl:col-span-8 flex flex-col gap-8">
            <section className="glass rounded-[3rem] border border-white/5 p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Cpu size={120} />
              </div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{t('digitalTwinVisualization') || 'Universal Digital Twin Scan'}</h2>
                  <p className="text-xs text-slate-500 mt-1">Real-time spatial data synthesis across {shops.length} nodes</p>
                </div>
              </div>
              <DigitalTwin />
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <GamificationWidget />
               <div className="glass p-8 rounded-[3rem] border border-white/5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                       <Zap size={18} className="text-amber-400" />
                       Strategic Simulation
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 italic">Forecast revenue based on dynamic variables.</p>
                  </div>
                  <button 
                    onClick={() => setIsSimOpen(true)}
                    className="w-full py-4 rounded-2xl bg-indigo-600 font-bold text-white shadow-[0_8px_32px_rgba(99,102,241,0.3)] hover:bg-indigo-500 transition-all transform hover:-translate-y-1"
                  >
                     Initiate Scenario Analysis
                  </button>
               </div>
            </div>
          </div>

          <aside className="xl:col-span-4 flex flex-col gap-6">
            <div className="glass p-8 rounded-[3rem] border border-white/5 flex-1">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 uppercase tracking-tighter">
                <Activity size={18} className="text-rose-400" />
                Neural Alerts
              </h3>
              <div className="space-y-4">
                {unresolvedAlerts.map((a) => (
                  <motion.div
                    key={a.id}
                    className={`p-5 rounded-3xl border flex gap-4 transition-all hover:translate-x-1 ${
                      a.type === 'CRITICAL'
                        ? 'bg-rose-500/5 border-rose-500/20'
                        : a.type === 'WARNING'
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-indigo-500/5 border-indigo-500/20'
                    }`}
                  >
                    <div className="p-2 rounded-xl h-fit bg-white/5">
                        <AlertTriangle size={18} className={a.type === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-[0.1em]">{a.type}</h4>
                      <p className="text-sm text-slate-400 mt-1 leading-snug">{a.message}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <AIAssistantWidget />
          </aside>
        </div>

        <SimulationModal isOpen={isSimOpen} onClose={() => setIsSimOpen(false)} />
    </AppShell>
  );
}
