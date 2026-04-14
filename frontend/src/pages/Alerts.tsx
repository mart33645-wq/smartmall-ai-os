import { Bell, ShieldAlert, AlertTriangle, Info, CheckCircle, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../i18n/LangContext';
import type { TranslationKey } from '../i18n/cleanTranslations';
import { useStore, type Alert } from '../store/useStore';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

const typeConfig: Record<string, { bg: string; border: string; icon: string; labelKey: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: 'text-red-400', labelKey: 'critical' },
  WARNING:  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: 'text-amber-400', labelKey: 'warning' },
  INFO:     { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', icon: 'text-indigo-400', labelKey: 'info' },
  SUCCESS:  { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', icon: 'text-emerald-400', labelKey: 'success' },
};

const AlertIcon = ({ type }: { type: string }) => {
  const icons: Record<string, typeof Bell> = {
    CRITICAL: ShieldAlert,
    WARNING: AlertTriangle,
    INFO: Info,
    SUCCESS: CheckCircle,
  };
  const Ic = icons[type] || Bell;
  return <Ic size={18} />;
};

export default function Alerts() {
  const { t } = useLang();
  const { alerts, setAlerts, resolveAlert, removeAlert } = useStore();
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/alerts');
      setAlerts(res.data);
    } catch {
      toast.error(t('failedLoadAlerts'));
    } finally {
      setLoading(false);
    }
  }, [setAlerts, t]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (id: number) => {
    try {
      await api.patch(`/api/alerts/${id}/resolve`);
      resolveAlert(id);
      toast.success(t('alertResolved'));
    } catch {
      toast.error(t('failedResolveAlert'));
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await api.delete(`/api/alerts/${id}`);
      removeAlert(id);
      toast.success(t('alertDismissed'));
    } catch {
      toast.error(t('failedDismissAlert'));
    }
  };

  const handleMarkAllRead = async () => {
    const unresolved = alerts.filter(a => !a.is_resolved);
    try {
      await Promise.all(unresolved.map(a => api.patch(`/api/alerts/${a.id}/resolve`)));
      const refreshed = await api.get('/api/alerts');
      setAlerts(refreshed.data);
      toast.success(`${t('resolvedAlerts')} (${unresolved.length})`);
    } catch {
      toast.error(t('failedResolveAll'));
    }
  };

  const unread = alerts.filter(a => !a.is_resolved).length;

  const filters = ['ALL', 'CRITICAL', 'WARNING', 'INFO'];
  const filtered: Alert[] = filter === 'ALL'
    ? alerts
    : alerts.filter(a => a.type === filter);

  const countOf = (t: string) => alerts.filter(a => a.type === t).length;

  return (
    <AppShell>
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-10"
        >
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              {t('neuralAlerts')}
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="w-7 h-7 bg-red-500 text-white text-xs font-extrabold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30"
                >
                  {unread}
                </motion.span>
              )}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">{t('neuralAlertsSub')}</p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={fetchAlerts}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-300 glass border border-white/10 hover:border-white/20 transition-all flex items-center gap-2"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {t('refresh')}
            </motion.button>
            {unread > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleMarkAllRead}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/40 transition-all flex items-center gap-2"
              >
                {t('resolveAll')} ({unread})
              </motion.button>
            )}
          </div>
        </motion.header>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {['CRITICAL', 'WARNING', 'INFO', 'SUCCESS'].map(type => {
            const count = countOf(type);
            const c = typeConfig[type];
            return (
              <motion.button
                key={type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                onClick={() => setFilter(filter === type ? 'ALL' : type)}
                className="p-4 rounded-2xl text-start transition-all"
                style={{
                  background: filter === type ? c.bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${filter === type ? c.border : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${c.icon}`}>{t(c.labelKey as TranslationKey)}</p>
                <p className="text-2xl font-extrabold text-white">{count}</p>
              </motion.button>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className="flex space-x-2 mb-6">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                filter === f
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                  : 'text-slate-500 border-white/5 hover:border-white/10 hover:text-slate-300'
              }`}
            >
              {f === 'ALL' ? `${t('all')} (${alerts.length})` : `${t(typeConfig[f].labelKey as TranslationKey)} (${countOf(f)})`}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((alert, i) => {
              const c = typeConfig[alert.type] ?? typeConfig.INFO;
              const timeStr = alert.created_at
                ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-start space-x-4 p-5 rounded-2xl transition-all ${alert.is_resolved ? 'opacity-40' : ''}`}
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                >
                  <div className={`${c.icon} mt-0.5 flex-shrink-0`}>
                    <AlertIcon type={alert.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-white text-sm">
                        {alert.type}
                        {alert.zone && <span className="text-slate-500 font-normal ml-2 text-xs">— {alert.zone}</span>}
                      </span>
                      <div className="flex items-center space-x-2 ms-4 flex-shrink-0">
                        {timeStr && <span className="text-[11px] text-slate-500">{timeStr}</span>}
                        {!alert.is_resolved && (
                          <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                        )}
                        {!alert.is_resolved && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="text-emerald-500 hover:text-emerald-400 transition-colors text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20"
                          >
                            {t('resolve')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          className="text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{alert.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 text-slate-600"
            >
              <Bell size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold">{t('noAlerts')}</p>
            </motion.div>
          )}
        </div>
    </AppShell>
  );
}
