import {
  BarChart2,
  Bot,
  Car,
  Cpu,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  ShoppingBag,
  Zap,
} from 'lucide-react';
import { memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useLang } from '../i18n/LangContext';
import { formatNumber, localizeRole } from '../i18n/format';
import { useStore } from '../store/useStore';

type IconComponent = typeof LayoutDashboard;

interface NavItemProps {
  icon: IconComponent;
  label: string;
  to: string;
  active: boolean;
  badge?: string;
}

const NavItem = memo(({ icon: Icon, label, to, active, badge }: NavItemProps) => (
  <Link to={to} className="group relative block">
    <div
      className={`flex items-center gap-4 rounded-[1.5rem] px-6 py-4 transition-all duration-300 ${
        active
          ? 'border border-indigo-500/30 bg-indigo-600/20 text-white shadow-[0_4px_20px_rgba(99,102,241,0.1)]'
          : 'text-slate-500 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={20} className={active ? 'text-indigo-400' : 'group-hover:text-indigo-300'} />
      <span className={`text-sm font-bold tracking-tight ${active ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>
        {label}
      </span>
      {badge ? (
        <span className="ms-auto rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-black text-white shadow-[0_0_10px_#6366f1]">
          {badge}
        </span>
      ) : null}
      {active ? (
        <div className="absolute top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1] rtl:right-1 ltr:left-1" />
      ) : null}
    </div>
  </Link>
));

const Sidebar = ({ onLogout }: { onLogout?: () => void } = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const atRiskShops = useStore((state) => state.shops.filter((shop) => shop.is_at_risk).length);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }

    setUser(null);
    navigate('/', { replace: true });
    window.location.reload();
  };

  const menuGroups = [
    {
      title: t('intelligence'),
      items: [
        { icon: LayoutDashboard, label: t('dashboard'), to: '/' },
        { icon: Bot, label: t('assistantLauncherTitle'), to: '/assistant' },
        { icon: Cpu, label: t('aiTasks'), to: '/tasks' },
        { icon: BarChart2, label: t('analytics'), to: '/analytics' },
      ],
    },
    {
      title: t('operations'),
      items: [
        {
          icon: ShoppingBag,
          label: t('shops'),
          to: '/shops',
          badge: atRiskShops > 0 ? formatNumber(atRiskShops, lang) : undefined,
        },
        { icon: Car, label: t('smartParking'), to: '/parking' },
      ],
    },
    {
      title: t('system'),
      items: [{ icon: SettingsIcon, label: t('settings'), to: '/settings' }],
    },
  ];

  return (
    <aside className="w-full border-b border-white/5 bg-[#050505] p-4 md:h-screen md:w-80 md:shrink-0 md:border-b-0 md:border-r md:p-6">
      <div className="mb-4 flex items-center gap-4 px-4 py-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-[0_8px_32px_rgba(99,102,241,0.2)]">
          <Zap className="text-white" size={24} fill="white" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">{lang === 'ar' ? 'سمارت مول' : 'SmartMall'}</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
            {lang === 'ar' ? 'منصة التشغيل الذكية' : 'AI OPERATIONS OS'}
          </p>
        </div>
      </div>

      <div className="mx-4 mb-6 rounded-[1.5rem] border border-white/5 bg-white/5 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{t('mallAdmin')}</p>
        <p className="mt-2 text-sm font-bold text-white">{user?.full_name || t('mallAdmin')}</p>
        <p className="mt-1 text-xs text-slate-500">
          {localizeRole(user?.role || 'admin', lang)} · {formatNumber(atRiskShops, lang)} {t('atRisk')}
        </p>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-8 overflow-y-auto pt-4">
        {menuGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <h3 className="px-6 text-[10px] font-black tracking-[0.2em] text-slate-600">{group.title}</h3>
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

      <div className="mt-6 border-t border-white/5 pt-6">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-4 rounded-[1.5rem] px-6 py-4 text-slate-500 transition-all hover:bg-rose-500/5 hover:text-rose-400"
        >
          <LogOut size={20} />
          <span className="text-sm font-bold">{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
