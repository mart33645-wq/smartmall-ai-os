import { BatteryCharging, MapPin, Activity, Zap, Car, RefreshCw, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../i18n/LangContext';
import type { TranslationKey } from '../i18n/cleanTranslations';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore, type ParkingSlot } from '../store/useStore';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

interface SlotCellProps {
  slot: ParkingSlot;
  onToggle: (slotId: number) => void;
  index: number;
}

const SlotCell = ({ slot, onToggle, index }: SlotCellProps) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.008 }}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    onClick={() => onToggle(slot.id)}
    title={`${slot.slot_number} — ${slot.is_occupied ? 'Occupied' : 'Free'} (${slot.type})`}
    className={`aspect-square rounded-xl flex flex-col items-center justify-center p-1.5 transition-all border ${
      slot.is_occupied
        ? 'border-indigo-500/40 bg-indigo-500/10'
        : 'border-white/5 bg-white/2 hover:border-emerald-500/30 hover:bg-emerald-500/5'
    }`}
  >
    {slot.is_occupied ? (
      <Car size={12} className="text-indigo-400" />
    ) : (
      <div className="w-2 h-2 rounded-sm border border-white/10" />
    )}
    <span className="text-[7px] font-bold mt-0.5" style={{ color: slot.is_occupied ? '#818cf8' : '#1e293b' }}>
      {slot.slot_number?.replace('P-', '')}
    </span>
    {slot.type === 'EV' && <BatteryCharging size={8} className="text-emerald-400 mt-0.5" />}
    {slot.type === 'Disabled' && <span className="text-[6px] text-blue-400">♿</span>}
  </motion.button>
);

export default function ParkingSystem() {
  const { t } = useLang();
  const { parkingSlots, setParkingSlots, parkingStats, setParkingStats, mergeParkingSlot } = useStore();
  const [level, setLevel] = useState('L1');
  const [loading, setLoading] = useState(false);

  const fetchParking = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsRes, statsRes] = await Promise.all([
        api.get('/api/parking'),
        api.get('/api/parking/stats'),
      ]);
      setParkingSlots(slotsRes.data);
      setParkingStats(statsRes.data);
    } catch {
      toast.error(t('fetchParkingFailed'));
    } finally {
      setLoading(false);
    }
  }, [setParkingSlots, setParkingStats, t]);

  useEffect(() => {
    fetchParking();
  }, [fetchParking]);

  const handleToggle = async (slotId: number) => {
    try {
      const { data } = await api.post<ParkingSlot>(`/api/parking/${slotId}/toggle`);
      mergeParkingSlot(data);
      const statsRes = await api.get('/api/parking/stats');
      setParkingStats(statsRes.data);
    } catch {
      toast.error(t('toggleFailed'));
    }
  };

  const levelSlots: Record<string, ParkingSlot[]> = {
    L1: parkingSlots.slice(0, 20),
    L2: parkingSlots.slice(20, 40),
    L3: parkingSlots.slice(40, 60),
  };
  const currentSlots = levelSlots[level] ?? [];
  const laneA = currentSlots.slice(0, 10);
  const laneB = currentSlots.slice(10, 20);

  const pct = parkingStats?.occupancy_pct ?? 0;
  const predictionData = parkingStats
    ? [
        { time: t('now'), occupancy: Math.round(pct) },
        { time: '+30m', occupancy: Math.min(100, Math.round(pct + 5)) },
        { time: '+1h', occupancy: Math.min(100, Math.round(parkingStats.prediction_next_hour)) },
        { time: '+2h', occupancy: Math.min(100, Math.round(parkingStats.prediction_next_hour * 1.05)) },
        { time: '+3h', occupancy: Math.max(40, Math.round(pct * 0.85)) },
      ]
    : [];

  return (
    <AppShell>
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-10"
        >
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">{t('parkingTitle')}</h1>
            <p className="text-slate-500 mt-1 text-sm">{t('realTimeSlotMgmt')}</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={fetchParking}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-sm text-slate-300 hover:text-white transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {t('refresh')}
            </motion.button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-emerald-500/20 text-emerald-400 text-sm font-bold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {t('liveFeed')}
            </div>
          </div>
        </motion.header>

        {/* Stats bar */}
        {parkingStats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: t('totalSlots'), value: parkingStats.total, icon: MapPin, border: 'border-indigo-500/10', text: 'text-indigo-400' },
                { label: t('occupied'), value: parkingStats.occupied, icon: Car, border: 'border-rose-500/10', text: 'text-rose-400' },
                { label: t('available'), value: parkingStats.available, icon: Activity, border: 'border-emerald-500/10', text: 'text-emerald-400' },
                { label: t('evCharging'), value: `${parkingStats.ev_occupied}/${parkingStats.ev_total}`, icon: Zap, border: 'border-amber-500/10', text: 'text-amber-400' },
              ].map(({ label, value, icon: Icon, border, text }) => (
              <div key={label} className={`glass p-4 rounded-2xl border ${border}`}>
                <Icon size={16} className={`${text} mb-2`} />
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Slot Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3 glass rounded-2xl p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-lg font-bold text-white">{t('mainGarage')} {level.replace('L', '')}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {t('clickToToggle')} · {laneA.filter(s => s.is_occupied).length + laneB.filter(s => s.is_occupied).length} {t('occupied')} / {currentSlots.length} {t('totalSlots')}
                </p>
              </div>
              <div className="flex space-x-2">
                {['L1', 'L2', 'L3'].map(l => (
                  <motion.button
                    key={l}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLevel(l)}
                    className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                      l === level
                        ? 'text-white border border-indigo-500/40'
                        : 'text-slate-500 border border-white/5 hover:border-white/10 hover:text-slate-300'
                    }`}
                    style={l === level ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : {}}
                  >
                    {l}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">{t('lane')} A</p>
              <div className="grid grid-cols-10 gap-2">
                {laneA.map((s, i) => <SlotCell key={s.id} slot={s} onToggle={handleToggle} index={i} />)}
              </div>
            </div>
            <div className="h-px bg-white/5 my-4" />
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">{t('lane')} B</p>
              <div className="grid grid-cols-10 gap-2">
                {laneB.map((s, i) => <SlotCell key={s.id} slot={s} onToggle={handleToggle} index={i + 10} />)}
              </div>
            </div>

            <div className="flex items-center space-x-6 mt-8 pt-6 border-t border-white/5">
              {[
                { color: 'bg-indigo-500/20 border-indigo-500/40', label: t('occupied') },
                { color: 'bg-white/2 border-white/10', label: t('available') },
                { color: 'bg-emerald-500/20 border-emerald-500/40', label: t('evCharging') },
                { color: 'bg-blue-500/20 border-blue-500/40', label: 'Disabled' },
              ].map(item => (
                <div key={item.label} className="flex items-center space-x-2">
                  <div className={`w-4 h-4 rounded border ${item.color}`} />
                  <span className="text-xs text-slate-500">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Sidebar Stats */}
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                <Activity size={16} /> {t('liveStatus')}
              </h3>
              <div className="text-center mb-4">
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
                  className="text-5xl font-extrabold"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {pct}%
                </motion.p>
                <p className="text-sm text-slate-500 mt-1">{t('occupancyRate')}</p>
                <p className={`text-xs font-bold mt-1 ${parkingStats?.status === 'CRITICAL' ? 'text-rose-400' : parkingStats?.status === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {parkingStats?.status ? t(parkingStats.status.toLowerCase() as TranslationKey) : t('normal')}
                </p>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.6 }}
                  className="h-full rounded-full"
                  style={{
                    background:
                      pct > 85
                        ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                        : pct > 70
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  }}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl glass border border-amber-500/20"
            >
              <ShieldAlert className="text-amber-400 mb-3" size={24} />
              <h3 className="text-base font-bold text-white mb-2">{t('aiPredictionTitle')}</h3>
              <p className="text-slate-400 text-xs mb-4">
                {t('predictedPeak')} <strong className="text-white">~60 {t('minutes')}</strong>. {t('aiSuggestsActivatingValet')}
              </p>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={predictionData}>
                    <Line type="monotone" dataKey="occupancy" stroke="#818cf8" strokeWidth={2} dot={false} />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                      itemStyle={{ color: '#818cf8' }}
                      formatter={(v: number | string) => [`${v}%`, t('occupancyRate')]}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-4 mb-1">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '98%' }}
                  transition={{ duration: 1.5, delay: 0.8 }}
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }}
                />
              </div>
              <p className="text-[10px] text-slate-500">{t('confidenceScore')} 98.2%</p>
            </motion.div>
          </div>
        </div>
    </AppShell>
  );
}
