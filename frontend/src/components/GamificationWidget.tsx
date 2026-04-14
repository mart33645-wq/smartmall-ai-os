import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Gift, TrendingUp, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface LoyaltySummary {
  points: number;
  tier_label: string;
  next_reward_progress_pct: number;
  next_reward_label: string;
  engagement_streak_days: number;
}

export const GamificationWidget: React.FC = () => {
  const [data, setData] = useState<LoyaltySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data: d } = await api.get<LoyaltySummary>('/api/gamification/summary');
      setData(d);
    } catch {
      toast.error('Could not load loyalty data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const redeem = async () => {
    setBusy(true);
    try {
      const { data: r } = await api.post<{ message: string }>('/api/gamification/redeem', { reward: 'voucher_50' });
      toast.success(r.message);
      await load();
    } catch {
      toast.error('Redeem failed');
    } finally {
      setBusy(false);
    }
  };

  const history = async () => {
    setBusy(true);
    try {
      const { data: h } = await api.get<{ transactions: { when: string; delta: number; reason: string }[] }>(
        '/api/gamification/history',
      );
      const lines = h.transactions.map((t) => `${t.when}: ${t.delta > 0 ? '+' : ''}${t.delta} — ${t.reason}`).join('\n');
      toast.success(lines, { duration: 5000 });
    } catch {
      toast.error('Could not load history');
    } finally {
      setBusy(false);
    }
  };

  const pct = data?.next_reward_progress_pct ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass p-6 rounded-3xl border border-indigo-500/20 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Trophy size={80} className="text-indigo-400" />
      </div>

      <div className="relative z-10">
        <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <Star size={16} className="text-amber-400" />
          برنامج الولاء والتحفيز
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-4xl font-black text-white">{(data?.points ?? 0).toLocaleString()}</span>
              <span className="text-indigo-400 text-sm font-bold mb-1">نقطة · {data?.tier_label}</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">سلسلة {data?.engagement_streak_days ?? 0} أيام</p>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">الهدف: {data?.next_reward_label}</span>
                <span className="text-indigo-400 font-bold">{pct}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                disabled={busy}
                onClick={redeem}
                className="flex items-center justify-center gap-2 p-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/20 transition-all text-xs font-bold disabled:opacity-50"
              >
                <Gift size={14} />
                استبدال
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={history}
                className="flex items-center justify-center gap-2 p-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-2xl border border-white/5 transition-all text-xs font-bold disabled:opacity-50"
              >
                <TrendingUp size={14} />
                السجل
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
