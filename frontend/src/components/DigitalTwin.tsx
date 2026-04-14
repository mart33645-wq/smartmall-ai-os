import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

type ZoneColor = 'orange' | 'violet' | 'emerald' | 'indigo' | 'sky' | 'pink' | 'amber' | 'rose';

interface Zone {
  id: string;
  name: string;
  density: number;
  color: string;
}

const zoneStyles: Record<ZoneColor, { glow: string; surface: string }> = {
  orange: { glow: 'bg-orange-500', surface: 'bg-orange-500/5' },
  violet: { glow: 'bg-violet-500', surface: 'bg-violet-500/5' },
  emerald: { glow: 'bg-emerald-500', surface: 'bg-emerald-500/5' },
  indigo: { glow: 'bg-indigo-500', surface: 'bg-indigo-500/5' },
  sky: { glow: 'bg-sky-500', surface: 'bg-sky-500/5' },
  pink: { glow: 'bg-pink-500', surface: 'bg-pink-500/5' },
  amber: { glow: 'bg-amber-500', surface: 'bg-amber-500/5' },
  rose: { glow: 'bg-rose-500', surface: 'bg-rose-500/5' },
};

const toColor = (c: string): ZoneColor => {
  if (c in zoneStyles) return c as ZoneColor;
  return 'indigo';
};

const MallZone = ({ id, name, density, color }: Zone) => {
  const zc = toColor(color);
  const style = zoneStyles[zc];

  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      className="relative h-24 rounded-2xl glass-card flex flex-col items-center justify-center border border-white/5 cursor-crosshair group overflow-hidden"
    >
      <div className={`absolute inset-0 ${style.surface} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <motion.div
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`absolute top-2 right-2 h-4 w-4 rounded-full blur-md ${style.glow}`}
      />
      <span className="text-[10px] uppercase tracking-tighter text-slate-500 font-bold mb-1">{id}</span>
      <span className="text-xs font-black text-white text-center px-1">{name}</span>
      <div className="mt-2 px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-mono text-emerald-400">
        D: {density}%
      </div>
    </motion.div>
  );
};

export const DigitalTwin = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ zones: Zone[] }>('/api/analytics/digital-twin');
        if (!cancelled) {
          setZones(data.zones || []);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Live twin unavailable');
          setZones([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const t = window.setInterval(async () => {
      try {
        const { data } = await api.get<{ zones: Zone[] }>('/api/analytics/digital-twin');
        if (!cancelled) setZones(data.zones || []);
      } catch {
        /* keep last good */
      }
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  if (loading && zones.length === 0) {
    return (
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-8 bg-black/40 rounded-[2.5rem] border border-white/5 animate-pulse min-h-[200px]" />
    );
  }

  if (error && zones.length === 0) {
    return (
      <div className="p-8 rounded-[2.5rem] border border-rose-500/20 bg-rose-500/5 text-rose-300 text-sm text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-8 bg-black/40 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      {zones.map((z) => (
        <MallZone key={z.id} id={z.id} name={z.name} density={z.density} color={z.color} />
      ))}
      <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <div className="absolute top-0 left-2/4 w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <div className="absolute top-0 left-3/4 w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
    </div>
  );
};
