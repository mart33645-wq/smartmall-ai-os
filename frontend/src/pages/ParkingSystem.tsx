import { Activity, BatteryCharging, Car, MapPin, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';

import { AppShell } from '../components/AppShell';
import { useLang } from '../i18n/LangContext';
import { formatNumber, formatPercent, localizeParkingType } from '../i18n/format';
import { api } from '../lib/api';
import { useStore, type ParkingSlot } from '../store/useStore';

interface SlotCellProps {
  slot: ParkingSlot;
  onToggle: (slotId: number) => void;
}

const SlotCell = ({ slot, onToggle }: SlotCellProps) => {
  return (
    <button
      onClick={() => onToggle(slot.id)}
      className={`aspect-square rounded-xl border p-1.5 transition hover:scale-105 ${
        slot.is_occupied
          ? 'border-cyan-400/30 bg-cyan-500/10'
          : 'border-white/8 bg-white/4 hover:border-emerald-500/30 hover:bg-emerald-500/5'
      }`}
      title={`${slot.slot_number} - ${localizeParkingType(slot.type, 'en')}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-1">
        {slot.is_occupied ? <Car size={12} className="text-cyan-300" /> : <div className="h-2 w-2 rounded-sm border border-white/10" />}
        <span className="text-[8px] font-bold text-slate-300">{slot.slot_number?.replace('P-', '')}</span>
        {slot.type === 'EV' ? <BatteryCharging size={8} className="text-emerald-300" /> : null}
      </div>
    </button>
  );
};

const ParkingSystem = () => {
  const { t, lang } = useLang();
  const { parkingSlots, setParkingSlots, parkingStats, setParkingStats, mergeParkingSlot } = useStore();
  const [level, setLevel] = useState('L1');
  const [loading, setLoading] = useState(false);

  const fetchParking = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsResponse, statsResponse] = await Promise.all([
        api.get<ParkingSlot[]>('/api/parking/'),
        api.get('/api/parking/stats'),
      ]);

      setParkingSlots(slotsResponse.data);
      setParkingStats(statsResponse.data);
    } catch {
      toast.error(t('fetchParkingFailed'));
    } finally {
      setLoading(false);
    }
  }, [setParkingSlots, setParkingStats, t]);

  useEffect(() => {
    void fetchParking();
  }, [fetchParking]);

  const handleToggle = async (slotId: number) => {
    try {
      const { data } = await api.post<ParkingSlot>(`/api/parking/${slotId}/toggle`);
      mergeParkingSlot(data);
      const statsResponse = await api.get('/api/parking/stats');
      setParkingStats(statsResponse.data);
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
  const occupancy = parkingStats?.occupancy_pct ?? 0;

  const predictionData = parkingStats
    ? [
        { time: t('now'), occupancy: Math.round(occupancy) },
        { time: '+30m', occupancy: Math.min(100, Math.round(occupancy + 4)) },
        { time: '+1h', occupancy: Math.round(parkingStats.prediction_next_hour) },
        { time: '+2h', occupancy: Math.min(100, Math.round(parkingStats.prediction_next_hour * 1.04)) },
      ]
    : [];

  const parkingRecommendation =
    occupancy >= 90
      ? lang === 'ar'
        ? 'يوصي النظام بتفعيل التوجيه الفوري للمواقف البديلة ورفع جاهزية خدمة صف السيارات.'
        : 'The system recommends enabling overflow routing and raising valet readiness immediately.'
      : occupancy >= 75
        ? lang === 'ar'
          ? 'الضغط التشغيلي يرتفع. من الأفضل دعم اللوحات الإرشادية ومراقبة المداخل خلال الساعة القادمة.'
          : 'Operational pressure is rising. Strengthen signage and monitor entrance flow during the next hour.'
        : lang === 'ar'
          ? 'الوضع مستقر حاليًا، ويمكن استغلال السعة المتاحة لتحسين تجربة الوصول.'
          : 'Current conditions are stable, and available capacity can be used to smooth visitor arrival.';

  return (
    <AppShell>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">{t('parkingTitle')}</h1>
          <p className="mt-2 text-sm text-slate-400">{t('realTimeSlotMgmt')}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void fetchParking()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:text-white disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('refresh')}
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {t('liveFeed')}
          </div>
        </div>
      </motion.header>

      {parkingStats ? (
        <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            { label: t('totalSlots'), value: formatNumber(parkingStats.total, lang), icon: MapPin, tone: 'text-cyan-300' },
            { label: t('occupied'), value: formatNumber(parkingStats.occupied, lang), icon: Car, tone: 'text-rose-300' },
            { label: t('available'), value: formatNumber(parkingStats.available, lang), icon: Activity, tone: 'text-emerald-300' },
            { label: t('evCharging'), value: `${formatNumber(parkingStats.ev_occupied, lang)}/${formatNumber(parkingStats.ev_total, lang)}`, icon: Zap, tone: 'text-amber-200' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="glass rounded-[1.8rem] border border-white/10 p-5">
                <Icon size={18} className={item.tone} />
                <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
                <p className="mt-1 text-xs text-slate-500">{item.label}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <section className="glass rounded-[2rem] border border-white/10 p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">
                {t('mainGarage')} {level.replace('L', '')}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {t('clickToToggle')} · {formatNumber(currentSlots.filter((slot) => slot.is_occupied).length, lang)} / {formatNumber(currentSlots.length, lang)}
              </p>
            </div>

            <div className="flex gap-2">
              {['L1', 'L2', 'L3'].map((item) => (
                <button
                  key={item}
                  onClick={() => setLevel(item)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    level === item
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white'
                      : 'border border-white/10 bg-white/4 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{t('lane')} A</p>
              <div className="grid grid-cols-10 gap-2">
                {laneA.map((slot) => (
                  <SlotCell key={slot.id} slot={slot} onToggle={handleToggle} />
                ))}
              </div>
            </div>

            <div className="border-t border-white/8 pt-5">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{t('lane')} B</p>
              <div className="grid grid-cols-10 gap-2">
                {laneB.map((slot) => (
                  <SlotCell key={slot.id} slot={slot} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 border-t border-white/8 pt-6">
            {['Standard', 'EV', 'Disabled'].map((type) => (
              <div key={type} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-3 w-3 rounded-sm border border-white/10 bg-white/5" />
                {localizeParkingType(type, lang)}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="glass rounded-[2rem] border border-white/10 p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
              <Activity size={14} />
              {t('liveStatus')}
            </div>

            <p className="text-5xl font-black text-white">{formatPercent(occupancy, lang)}</p>
            <p className="mt-2 text-sm text-slate-500">{t('occupancyRate')}</p>

            <div className="mt-4 h-2 rounded-full bg-white/6">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${occupancy}%` }}
                className="h-full rounded-full"
                style={{
                  background:
                    occupancy >= 90
                      ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                      : occupancy >= 75
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #06b6d4, #6366f1)',
                }}
              />
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">{parkingRecommendation}</p>
          </div>

          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/8 p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">
              <ShieldAlert size={14} />
              {t('aiPredictionTitle')}
            </div>

            <p className="mb-4 text-sm leading-6 text-slate-200">
              {t('predictedPeak')} {formatNumber(60, lang)} {t('minutes')}. {t('aiSuggestion')}: {parkingRecommendation}
            </p>

            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={predictionData}>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                    formatter={(value: number | string) => [`${value}%`, t('occupancyRate')]}
                  />
                  <Line type="monotone" dataKey="occupancy" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-3 text-xs text-slate-400">{t('confidenceScore')}: 98.2%</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
};

export default ParkingSystem;
