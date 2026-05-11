import {
  Activity,
  BatteryCharging,
  Car,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';

import { AppShell } from '../components/AppShell';
import { useLang } from '../i18n/LangContext';
import { formatNumber, formatPercent, localizeParkingType } from '../i18n/format';
import { api, wsUrl } from '../lib/api';
import { demoParkingSlots, demoParkingStats } from '../lib/demoData';
import { useStore, type ParkingSlot } from '../store/useStore';

// ── Slot Cell ──────────────────────────────────────────────────────────────────

interface SlotCellProps {
  slot: ParkingSlot;
  onToggle: (id: number) => void;
}

const SlotCell = ({ slot, onToggle }: SlotCellProps) => {
  const typeColor = {
    EV: 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20',
    Disabled: 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20',
    Standard: 'border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/8',
  }[slot.type] ?? 'border-white/8 bg-white/4';

  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onToggle(slot.id)}
      className={`aspect-square rounded-xl border p-1 transition-all duration-200 ${
        slot.is_occupied
          ? 'border-cyan-400/50 bg-cyan-500/15 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
          : typeColor
      }`}
      title={`${slot.slot_number} — ${slot.type}${slot.is_occupied ? ' (Occupied)' : ' (Free)'}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-0.5">
        {slot.is_occupied ? (
          <Car size={11} className="text-cyan-300" />
        ) : (
          <div
            className={`h-2 w-2 rounded-sm ${
              slot.type === 'EV'
                ? 'border border-emerald-400/50'
                : slot.type === 'Disabled'
                  ? 'border border-blue-400/50'
                  : 'border border-white/10'
            }`}
          />
        )}
        <span className="text-[7px] font-bold leading-none text-slate-400">
          {slot.slot_number?.replace(/^[A-Z]+-?/, '')}
        </span>
        {slot.type === 'EV' && <BatteryCharging size={7} className="text-emerald-400" />}
      </div>
    </motion.button>
  );
};

// ── Occupancy Donut ────────────────────────────────────────────────────────────

const OccupancyDonut = ({ occupancy }: { occupancy: number }) => {
  const free = Math.max(0, 100 - occupancy);
  const data = [
    { name: 'Occupied', value: occupancy },
    { name: 'Free', value: free },
  ];
  const color =
    occupancy >= 90
      ? '#ef4444'
      : occupancy >= 75
        ? '#f59e0b'
        : '#06b6d4';

  return (
    <div className="relative flex items-center justify-center">
      <PieChart width={120} height={120}>
        <Pie
          data={data}
          cx={55}
          cy={55}
          innerRadius={38}
          outerRadius={52}
          startAngle={90}
          endAngle={-270}
          dataKey="value"
          strokeWidth={0}
        >
          <Cell fill={color} />
          <Cell fill="rgba(255,255,255,0.05)" />
        </Pie>
      </PieChart>
      <div className="pointer-events-none absolute flex flex-col items-center">
        <span className="text-xl font-black text-white">{Math.round(occupancy)}%</span>
        <span className="text-[9px] text-slate-500">Used</span>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const ParkingSystem = () => {
  const { t, lang } = useLang();
  const {
    parkingSlots,
    setParkingSlots,
    parkingStats,
    setParkingStats,
    mergeParkingSlot,
    refreshVersion,
  } = useStore();

  const [level, setLevel] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const cancelRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchParking = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsRes, statsRes] = await Promise.all([
        api.get<ParkingSlot[]>('/api/parking/'),
        api.get('/api/parking/stats'),
      ]);
      setParkingSlots(slotsRes.data);
      setParkingStats(statsRes.data);
    } catch {
      toast.error(t('fetchParkingFailed'));
      setParkingSlots(demoParkingSlots);
      setParkingStats(demoParkingStats);
    } finally {
      setLoading(false);
    }
  }, [setParkingSlots, setParkingStats, t]);

  useEffect(() => {
    void fetchParking();
  }, [fetchParking, refreshVersion]);

  // ── WebSocket live updates ───────────────────────────────────────────────────

  useEffect(() => {
    const env = (import.meta as unknown as { env: Record<string, string> }).env;
    const WS_URL = (env.VITE_WS_URL && env.VITE_WS_URL.trim()) || wsUrl('/ws');

    let reconnectDelay = 1000;
    let alive = true;

    const connect = () => {
      if (!alive) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          reconnectDelay = 1000;
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string) as {
              type: string;
              payload: { slot: ParkingSlot; stats: unknown };
            };
            if (msg.type === 'PARKING_UPDATE') {
              mergeParkingSlot(msg.payload.slot);
              if (msg.payload.stats) {
                setParkingStats(msg.payload.stats as Parameters<typeof setParkingStats>[0]);
              }
            }
          } catch {
            /* ignore malformed messages */
          }
        };

        ws.onerror = () => setWsConnected(false);

        ws.onclose = () => {
          setWsConnected(false);
          wsRef.current = null;
          if (alive) {
            cancelRef.current = setTimeout(() => {
              reconnectDelay = Math.min(reconnectDelay * 1.5, 15_000);
              connect();
            }, reconnectDelay);
          }
        };
      } catch {
        setWsConnected(false);
      }
    };

    connect();

    return () => {
      alive = false;
      if (cancelRef.current) clearTimeout(cancelRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [mergeParkingSlot, setParkingStats]);

  // ── Toggle slot ──────────────────────────────────────────────────────────────

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

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Dynamic level filtering from actual slot.level field
  const availableLevels = [...new Set(parkingSlots.map((s) => s.level ?? 1))].sort();
  const safeLevel = availableLevels.includes(level) ? level : (availableLevels[0] ?? 1);
  const currentSlots = parkingSlots.filter((s) => (s.level ?? 1) === safeLevel);
  const laneA = currentSlots.slice(0, Math.ceil(currentSlots.length / 2));
  const laneB = currentSlots.slice(Math.ceil(currentSlots.length / 2));

  const occupancy = parkingStats?.occupancy_pct ?? 0;
  const levelOccupancy =
    currentSlots.length > 0
      ? Math.round((currentSlots.filter((s) => s.is_occupied).length / currentSlots.length) * 100)
      : 0;

  const predictionData = parkingStats
    ? [
        { time: t('now'), value: Math.round(occupancy) },
        { time: '+30m', value: Math.min(100, Math.round(occupancy + 4)) },
        { time: '+1h', value: Math.round(parkingStats.prediction_next_hour) },
        { time: '+2h', value: Math.min(100, Math.round(parkingStats.prediction_next_hour * 1.04)) },
      ]
    : [];

  const occupancyColor =
    occupancy >= 90 ? 'text-rose-300' : occupancy >= 75 ? 'text-amber-300' : 'text-emerald-300';

  const recommendation =
    occupancy >= 90
      ? lang === 'ar'
        ? 'يوصي النظام بتفعيل التوجيه الفوري للمواقف البديلة.'
        : 'Enable overflow routing and raise valet readiness immediately.'
      : occupancy >= 75
        ? lang === 'ar'
          ? 'الضغط التشغيلي يرتفع. راقب المداخل خلال الساعة القادمة.'
          : 'Operational pressure rising — monitor entrance flow.'
        : lang === 'ar'
          ? 'الوضع مستقر. استغل السعة المتاحة لتحسين تجربة الوصول.'
          : 'Conditions stable — capacity available for smooth visitor arrival.';

  return (
    <AppShell>
      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">{t('parkingTitle')}</h1>
          <p className="mt-2 text-sm text-slate-400">{t('realTimeSlotMgmt')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* WS status badge */}
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
              wsConnected
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
            }`}
          >
            {wsConnected ? (
              <>
                <Wifi size={12} />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('liveFeed')}
              </>
            ) : (
              <>
                <WifiOff size={12} />
                Reconnecting…
              </>
            )}
          </div>

          <button
            onClick={() => void fetchParking()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('refresh')}
          </button>
        </div>
      </motion.header>

      {/* ── KPI Strip ── */}
      <AnimatePresence>
        {parkingStats && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4"
          >
            {[
              {
                label: t('totalSlots'),
                value: formatNumber(parkingStats.total, lang),
                icon: MapPin,
                color: 'text-cyan-300',
                bg: 'bg-cyan-500/8',
              },
              {
                label: t('occupied'),
                value: formatNumber(parkingStats.occupied, lang),
                icon: Car,
                color: 'text-rose-300',
                bg: 'bg-rose-500/8',
              },
              {
                label: t('available'),
                value: formatNumber(parkingStats.available, lang),
                icon: Activity,
                color: 'text-emerald-300',
                bg: 'bg-emerald-500/8',
              },
              {
                label: t('evCharging'),
                value: `${formatNumber(parkingStats.ev_occupied, lang)}/${formatNumber(parkingStats.ev_total, lang)}`,
                icon: Zap,
                color: 'text-amber-200',
                bg: 'bg-amber-500/8',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  whileHover={{ scale: 1.02 }}
                  className={`glass rounded-[1.8rem] border border-white/10 p-5 ${item.bg}`}
                >
                  <Icon size={18} className={item.color} />
                  <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.label}</p>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Grid ── */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.8fr)_360px]">

        {/* ── Slot Map ── */}
        <section className="glass rounded-[2rem] border border-white/10 p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">
                {t('mainGarage')} — Level {safeLevel}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {t('clickToToggle')} ·{' '}
                <span className={occupancyColor}>{formatPercent(levelOccupancy, lang)}</span>{' '}
                occupied this level
              </p>
            </div>

            {/* Level selector */}
            <div className="flex gap-2">
              {(availableLevels.length > 0 ? availableLevels : [1, 2, 3]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    safeLevel === lvl
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/20'
                      : 'border border-white/10 bg-white/4 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  L{lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Lanes */}
          {currentSlots.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-slate-500 text-sm">
              {loading ? 'Loading slots…' : 'No slots on this level'}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {t('lane')} A
                </p>
                <div className="grid grid-cols-10 gap-1.5">
                  {laneA.map((slot) => (
                    <SlotCell key={slot.id} slot={slot} onToggle={handleToggle} />
                  ))}
                </div>
              </div>

              {laneB.length > 0 && (
                <div className="border-t border-white/8 pt-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {t('lane')} B
                  </p>
                  <div className="grid grid-cols-10 gap-1.5">
                    {laneB.map((slot) => (
                      <SlotCell key={slot.id} slot={slot} onToggle={handleToggle} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-5 border-t border-white/8 pt-5">
            {[
              { type: 'Standard', color: 'bg-white/8 border-white/15' },
              { type: 'EV', color: 'bg-emerald-500/15 border-emerald-500/30' },
              { type: 'Disabled', color: 'bg-blue-500/15 border-blue-500/30' },
              { type: 'Occupied', color: 'bg-cyan-500/20 border-cyan-400/40' },
            ].map(({ type, color }) => (
              <div key={type} className="flex items-center gap-2 text-xs text-slate-400">
                <span className={`h-3 w-3 rounded-sm border ${color}`} />
                {type === 'Occupied' ? type : localizeParkingType(type, lang)}
              </div>
            ))}
          </div>
        </section>

        {/* ── Right Sidebar ── */}
        <aside className="space-y-5">
          {/* Live status + donut */}
          <div className="glass rounded-[2rem] border border-white/10 p-6">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
              <Activity size={13} />
              {t('liveStatus')}
            </div>

            <div className="flex items-center gap-5">
              <OccupancyDonut occupancy={occupancy} />
              <div className="flex-1">
                <p className={`text-4xl font-black ${occupancyColor}`}>
                  {formatPercent(occupancy, lang)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{t('occupancyRate')}</p>
                <div className="mt-3 h-1.5 rounded-full bg-white/6 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${occupancy}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      background:
                        occupancy >= 90
                          ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                          : occupancy >= 75
                            ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                            : 'linear-gradient(90deg,#06b6d4,#6366f1)',
                    }}
                  />
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">{recommendation}</p>
          </div>

          {/* AI Prediction */}
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/8 p-6">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">
              <ShieldAlert size={13} />
              {t('aiPredictionTitle')}
            </div>
            <p className="mb-4 text-sm leading-6 text-slate-200">
              {t('predictedPeak')} {formatNumber(60, lang)} {t('minutes')}. {recommendation}
            </p>

            {predictionData.length > 0 && (
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={predictionData}>
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v}%`, t('occupancyRate')]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#fbbf24"
                      strokeWidth={2.5}
                      dot={{ fill: '#fbbf24', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">{t('confidenceScore')}: 98.2%</p>
          </div>

          {/* Stats breakdown */}
          {parkingStats && (
            <div className="glass rounded-[2rem] border border-white/10 p-6 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Breakdown
              </p>
              {[
                {
                  label: 'Standard',
                  count: parkingStats.total - parkingStats.ev_total,
                  color: 'bg-slate-400',
                },
                { label: 'EV', count: parkingStats.ev_total, color: 'bg-emerald-400' },
              ].map(({ label, count, color }) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>{label}</span>
                    <span>{formatNumber(count, lang)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/6">
                    <div
                      className={`h-full rounded-full ${color} opacity-70`}
                      style={{ width: `${(count / Math.max(parkingStats.total, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
};

export default ParkingSystem;
