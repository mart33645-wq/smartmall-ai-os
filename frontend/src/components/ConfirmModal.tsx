import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

import { translations } from '../i18n/cleanTranslations';
import { getStoredLang } from '../i18n/runtimeText';

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
  confirmText = translations[getStoredLang()].save,
  cancelText = translations[getStoredLang()].cancel,
  isDestructive = true,
}: ConfirmModalProps) => {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={(event) => event.target === event.currentTarget && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0b] shadow-2xl"
          >
            <div className={`flex items-start gap-4 border-b border-white/5 p-6 ${isDestructive ? 'bg-rose-500/5' : 'bg-indigo-500/5'}`}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isDestructive ? 'bg-rose-500/20 text-rose-500' : 'bg-indigo-500/20 text-indigo-400'}`}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 bg-black/20 p-6">
              <button
                onClick={onCancel}
                className="rounded-xl border border-transparent px-5 py-2.5 font-bold text-slate-300 transition hover:bg-white/5"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onCancel();
                }}
                className={`rounded-xl px-5 py-2.5 font-bold text-white shadow-lg transition ${
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
      ) : null}
    </AnimatePresence>
  );
};
