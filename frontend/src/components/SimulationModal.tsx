import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, TrendingUp, Info, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLang } from '../i18n/LangContext';
import { api } from '../lib/api';

const SimulationModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useLang();
  const [rentChange, setRentChange] = useState(0);
  const [trafficIndex, setTrafficIndex] = useState(1);
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    try {
      const resp = await api.post('/api/simulation/run', {
        current_revenue: 428500,
        rent_change: rentChange / 100,
        traffic_index: trafficIndex,
      });
      setResult(resp.data.result);
    } catch {
      toast.error('Simulation failed — check API or auth token');
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #0f0f1e 0%, #0a0a14 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>

            <div className="p-6 border-b border-white/5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white">{t('simulationTitle')}</h2>
                    <p className="text-xs text-slate-500">{t('simulationSub')}</p>
                  </div>
                </div>
                <motion.button onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <X size={16} />
                </motion.button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold text-slate-300">{t('rentAdjustment')}</label>
                  <span className={`px-3 py-1 rounded-lg text-sm font-extrabold ${
                    rentChange > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : rentChange < 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-white/5 text-slate-400 border border-white/10'
                  }`}>
                    {rentChange > 0 ? '+' : ''}{rentChange}%
                  </span>
                </div>
                <input type="range" min="-20" max="20" value={rentChange}
                  onChange={e => setRentChange(parseInt(e.target.value))}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between mt-1 text-xs text-slate-600">
                  <span>-20%</span><span>0%</span><span>+20%</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-300 mb-3 block">{t('trafficIndex')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.5, 1.0, 1.5, 2.0].map(v => (
                    <motion.button key={v} onClick={() => setTrafficIndex(v)}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${trafficIndex === v ? 'text-white' : 'text-slate-500 border border-white/5 hover:text-slate-300'}`}
                      style={trafficIndex === v ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' } : {}}>
                      {v}x
                    </motion.button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {result !== null && (
                  <motion.div initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-5 rounded-2xl"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={16} className="text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{t('projectedRevenue')}</span>
                    </div>
                    <p className="text-3xl font-extrabold text-white">${result.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                      <Info size={12} />{t('aiSuggestion')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button onClick={handleRun} disabled={loading}
                whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 30px rgba(99,102,241,0.5)' } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading
                  ? <><Loader2 size={18} className="animate-spin" /><span>{t('simulating')}</span></>
                  : <><Sparkles size={18} /><span>{t('runSimulationBtn')}</span></>
                }
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SimulationModal;
