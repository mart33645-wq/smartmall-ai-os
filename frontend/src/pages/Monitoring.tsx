import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, Cpu, Database, RefreshCw } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

type AccentColor = 'indigo' | 'violet' | 'emerald' | 'amber';

interface MonitoringMetrics {
  cpu_usage: string;
  memory_usage: string;
  request_rate: string;
  active_containers: number;
  websocket_clients?: number;
  logs: Array<{ level: string; service: string; message: string }>;
  services: Array<{ name: string; latency_pct: number }>;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: typeof Activity;
  color: AccentColor;
}

const colorClasses: Record<AccentColor, { text: string; bg: string }> = {
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const MetricCard = ({ title, value, icon: Icon, color }: MetricCardProps) => {
  const palette = colorClasses[color];

  return (
  <div className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${palette.text}`}>
      <Icon size={80} />
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl ${palette.bg} ${palette.text}`}>
          <Icon size={20} />
        </div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
    </div>
  </div>
  );
};

export const Monitoring = () => {
  const { t } = useLang();
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data } = await api.get<MonitoringMetrics>('/api/monitoring/metrics');
        setMetrics(data);
        setFailed(false);
      } catch (err) {
        console.error('Monitor failed:', err);
        setFailed(true);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const logs = metrics?.logs ?? [];
  const services = metrics?.services ?? [];
  const dash = '—';

  return (
    <AppShell mainClassName="text-slate-300">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">{t('systemMonitoring')}</h1>
            <p className="text-slate-500 font-medium">{t('systemMonitoringSub')}</p>
          </div>
          <div
            className={`flex items-center gap-3 px-4 py-2 rounded-full border text-xs font-bold ${
              failed || !metrics
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                failed || !metrics ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            {failed || !metrics ? 'Degraded / no data' : t('allSystemsNominal')}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard title={t('cpuLoad')} value={metrics?.cpu_usage ?? dash} icon={Cpu} color="indigo" />
          <MetricCard title={t('memory')} value={metrics?.memory_usage ?? dash} icon={Database} color="violet" />
          <MetricCard title={t('requestRate')} value={metrics?.request_rate ?? dash} icon={Activity} color="emerald" />
          <MetricCard
            title={t('activeServices')}
            value={metrics?.active_containers ?? dash}
            icon={Server}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass p-8 rounded-[2rem] border border-white/5">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold text-white">{t('liveLogsCluster')}</h3>
              <RefreshCw size={16} className="text-slate-500 animate-spin-slow" />
            </div>
            <div className="space-y-4 font-mono text-xs">
              {logs.map((log, index) => (
                <div key={`${log.service}-${index}`} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.level === 'WARNING' ? 'text-amber-400' : 'text-indigo-400'}>{log.level}</span>
                  <span className="text-slate-300">{log.service}: {log.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-8 rounded-[2rem] border border-white/5 h-full">
            <h3 className="text-lg font-bold text-white mb-6">{t('networkHealth')}</h3>
            <div className="space-y-6">
              {services.map((service) => (
                <div key={service.name} className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{service.name}</span>
                    <span className="text-emerald-400">{service.latency_pct}% {t('latency')}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${service.latency_pct}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </AppShell>
  );
};
