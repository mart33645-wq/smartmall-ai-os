import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  isDestructive = true
}: ConfirmModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-[#0a0a0b] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className={`p-6 border-b border-white/5 flex items-start gap-4 ${isDestructive ? 'bg-rose-500/5' : 'bg-indigo-500/5'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isDestructive ? 'bg-rose-500/20 text-rose-500' : 'bg-indigo-500/20 text-indigo-400'}`}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="p-6 flex items-center gap-3 justify-end bg-black/20">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-300 hover:bg-white/5 transition border border-transparent"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onCancel();
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-white transition shadow-lg ${
                  isDestructive 
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/50' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/50'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
