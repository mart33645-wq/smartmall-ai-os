import { BrainCircuit, X } from 'lucide-react';
import { motion } from 'framer-motion';

const Toast = ({ message, type, onClose }: { message: string; type: string; onClose: () => void }) => {
  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="fixed bottom-8 right-8 z-[100] flex items-center gap-4 p-4 pr-5 rounded-2xl shadow-2xl min-w-[340px] max-w-[400px]"
      style={{
        background: 'rgba(15, 15, 30, 0.95)',
        border: '1px solid rgba(99,102,241,0.4)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 40px rgba(99,102,241,0.2), 0 20px 40px rgba(0,0,0,0.5)',
      }}
    >
      {/* Glow strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, transparent)' }} />

      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        <BrainCircuit size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest">{type}</p>
        <p className="text-sm font-medium text-white mt-0.5 leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0">
        <X size={14} />
      </button>
    </motion.div>
  );
};

export default Toast;
