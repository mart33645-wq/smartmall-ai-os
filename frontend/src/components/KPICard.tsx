import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: ComponentType<{ size?: number; style?: CSSProperties }>;
  color: string;
  index?: number;
}

const KPICard = ({ title, value, change, isPositive, icon: Icon, color, index = 0 }: KPICardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
    whileHover={{ y: -4, scale: 1.01 }}
    className="relative overflow-hidden rounded-2xl p-5 glass glass-hover cursor-pointer"
  >
    {/* Glow background */}
    <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 opacity-10"
      style={{ background: color.replace('bg-', '').includes('indigo') ? '#6366f1' : color.replace('bg-', '').includes('purple') ? '#8b5cf6' : color.replace('bg-', '').includes('amber') ? '#f59e0b' : '#3b82f6' }} />

    <div className="flex items-start justify-between mb-4">
      <div className={`p-2.5 rounded-xl ${color} bg-opacity-20`}>
        <Icon size={18} style={{ color: color.includes('indigo') ? '#6366f1' : color.includes('purple') ? '#8b5cf6' : color.includes('amber') ? '#f59e0b' : '#3b82f6' }} />
      </div>
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 300 }}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
      >
        {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        <span>{change}</span>
      </motion.span>
    </div>

    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.1 + 0.2 }}
      className="text-slate-400 text-xs font-medium mb-1"
    >
      {title}
    </motion.p>
    <motion.p
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 + 0.25, type: 'spring', stiffness: 200 }}
      className="text-2xl font-extrabold text-white"
    >
      {value}
    </motion.p>

    {/* Bottom accent line */}
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ delay: index * 0.1 + 0.4, duration: 0.8 }}
      className="absolute bottom-0 left-0 right-0 h-0.5 origin-left"
      style={{ background: `linear-gradient(90deg, ${color.includes('indigo') ? '#6366f1' : color.includes('purple') ? '#8b5cf6' : color.includes('amber') ? '#f59e0b' : '#3b82f6'}, transparent)` }}
    />
  </motion.div>
);

export default KPICard;
