import { motion } from 'framer-motion';
import { Ghost, Search, ZapOff } from 'lucide-react';


interface EmptyStateProps {
  title: string;
  description: string;
  type?: 'search' | 'data' | 'connection';
  action?: () => void;
  actionText?: string;
}

export const EmptyState = ({ title, description, type = 'data', action, actionText }: EmptyStateProps) => {
  const icons = {
    search: <Search size={48} className="text-slate-500/30" />,
    data: <Ghost size={48} className="text-indigo-500/30" />,
    connection: <ZapOff size={48} className="text-rose-500/30" />
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="empty-state-glass w-full py-20 flex flex-col items-center justify-center rounded-[3rem] text-center px-6"
    >
      <div className="relative mb-6">
        <motion.div 
          animate={{ 
            y: [0, -10, 0],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          {icons[type]}
        </motion.div>
        <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full -z-10" />
      </div>
      
      <h3 className="text-xl font-black text-white mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-8">
        {description}
      </p>

      {action && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action}
          className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all hover:glow-indigo"
        >
          {actionText}
        </motion.button>
      )}
    </motion.div>
  );
};
