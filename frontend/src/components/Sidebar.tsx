import {
  LayoutDashboard, ShoppingBag,
  Car, BarChart2, Bell, Settings as SettingsIcon,
  Activity, Zap, LogOut,
  Cpu, Smartphone,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LangContext';
import { useStore } from '../store/useStore';

type IconComponent = typeof LayoutDashboard;

interface NavItemProps {
  icon: IconComponent;
  label: string;
  to: string;
  active: boolean;
  badge?: string;
}

const NavItem = ({ icon: Icon, label, to, active, badge }: NavItemProps) => (
  <Link to={to} className="relative block group">
    <motion.div 
      className={`flex items-center gap-4 px-6 py-4 rounded-[1.5rem] transition-all duration-300 ${
        active 
          ? 'bg-indigo-600/20 text-white border border-indigo-500/30 shadow-[0_4px_20px_rgba(99,102,241,0.1)]' 
        : 'text-slate-500 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={20} className={active ? 'text-indigo-400' : 'group-hover:text-indigo-300'} />
      <span className={`text-sm font-bold tracking-tight ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
        {label}
      </span>
      {badge && (
        <span className="ml-auto px-2 py-0.5 rounded-full bg-indigo-500 text-[10px] font-black text-white shadow-[0_0_10px_#6366f1]">
          {badge}
        </span>
      )}
      {active && (
        <motion.div 
          layoutId="active-pill"
          className="absolute left-1 w-1 h-8 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1]"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.div>
  </Link>
);

const Sidebar = ({ onLogout }: { onLogout?: () => void } = {}) => {
  const location = useLocation();
  const { t } = useLang();
  const user = useStore((state) => state.user);
  const activeAlerts = useStore((state) => state.alerts.filter((alert) => !alert.is_resolved).length);

  const menuGroups = [
    {
      title: t('intelligence'),
      items: [
        { icon: LayoutDashboard, label: t('dashboard'), to: '/' },
        { icon: Cpu, label: t('aiTasks'), to: '/tasks' },
        { icon: BarChart2, label: t('analytics'), to: '/analytics' },
      ]
    },
    {
      title: t('operations'),
      items: [
        { icon: ShoppingBag, label: t('shops'), to: '/shops' },
        { icon: Car, label: t('smartParking'), to: '/parking' },
        { icon: Smartphone, label: 'Customer', to: '/customer' },
        { icon: Bell, label: t('alertsHub'), to: '/alerts', badge: activeAlerts > 0 ? String(activeAlerts) : undefined },
      ]
    },
    {
      title: t('system'),
      items: [
        { icon: Activity, label: t('monitoring'), to: '/monitoring' },
        { icon: SettingsIcon, label: t('settings'), to: '/settings' },
      ]
    }
  ];

  return (
    <aside className="w-full border-b border-white/5 bg-[#050505] p-4 md:h-screen md:w-80 md:shrink-0 md:border-b-0 md:border-r md:p-6">
      <div className="flex items-center gap-4 px-4 py-8 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_8px_32px_rgba(99,102,241,0.2)]">
          <Zap className="text-white" size={24} fill="white" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tighter text-white">SMARTMALL</h2>
          <p className="text-[10px] font-black text-indigo-500 tracking-[0.3em] uppercase">Enterprise OS v4</p>
        </div>
      </div>

      <div className="mx-4 mb-6 rounded-[1.5rem] border border-white/5 bg-white/5 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{t('mallAdmin')}</p>
        <p className="mt-2 text-sm font-bold text-white">{user?.full_name || 'Mall Administrator'}</p>
        <p className="mt-1 text-xs text-slate-500">{user?.role || 'Admin'} · {activeAlerts} {t('activeAlerts')}</p>
      </div>

      <nav className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-2 pt-4">
        {menuGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <h3 className="px-6 text-[10px] font-black text-slate-600 tracking-[0.2em]">{group.title}</h3>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem 
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  to={item.to}
                  active={location.pathname === item.to}
                  badge={item.badge}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/5">
        <button onClick={onLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all group">
          <LogOut size={20} />
          <span className="text-sm font-bold">{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
