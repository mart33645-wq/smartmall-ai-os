import { User, Bell, Shield, Database, Save, CheckCircle, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useLang } from '../i18n/LangContext';
import { AppShell } from '../components/AppShell';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';

interface ToggleProps {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const Toggle = ({ label, desc, checked, onChange }: ToggleProps) => (
  <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
    <div className="flex-1 min-w-0 me-4">
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
    <motion.button onClick={() => onChange(!checked)} whileTap={{ scale: 0.9 }}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-indigo-600' : 'bg-white/10'}`}>
      <motion.span animate={{ x: checked ? 20 : 2 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg" />
    </motion.button>
  </div>
);

interface SectionProps {
  icon: typeof User;
  title: string;
  children: ReactNode;
}

const Section = ({ icon: Icon, title, children }: SectionProps) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
    <h2 className="text-base font-bold text-white flex items-center gap-2 mb-6">
      <Icon size={18} className="text-indigo-400" /> {title}
    </h2>
    {children}
  </motion.div>
);

const Settings = ({ onLogout }: { onLogout?: () => void }) => {
  const { t, lang, setLang } = useLang();
  const setUser = useStore((s) => s.setUser);
  const authUser = useStore((s) => s.user);
  const [notifs, setNotifs] = useState({ email: true, push: true, ai: true, weekly: false });
  const [profile, setProfile] = useState({ name: '', email: '', mall: 'SmartMall Central' });
  const [saved, setSaved] = useState(false);
  const [threshold, setThreshold] = useState(85);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{
          username: string;
          full_name: string;
          preferences?: {
            notifs?: typeof notifs;
            aiThreshold?: number;
            mallName?: string;
          };
        }>('/api/auth/me');
        setProfile({
          name: data.full_name || data.username,
          email: `${data.username}@mall.local`,
          mall: data.preferences?.mallName || 'SmartMall Central',
        });
        if (data.preferences?.notifs) setNotifs(data.preferences.notifs);
        if (typeof data.preferences?.aiThreshold === 'number') setThreshold(data.preferences.aiThreshold);
      } catch {
        if (authUser) {
          setProfile((p) => ({
            ...p,
            name: authUser.full_name || authUser.username,
            email: `${authUser.username}@mall.local`,
          }));
        }
      }
    })();
  }, [authUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/api/auth/me', {
        full_name: profile.name,
        preferences: {
          notifs,
          aiThreshold: threshold,
          mallName: profile.mall,
        },
      });
      if (authUser) {
        setUser({ ...authUser, full_name: profile.name });
      }
      setSaved(true);
      toast.success(t('saved'));
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell onLogout={onLogout}>
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">{t('settingsTitle')}</h1>
            <p className="text-slate-500 mt-1 text-sm">{t('settingsSub')}</p>
          </div>
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            {onLogout && (
              <motion.button onClick={onLogout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 rounded-xl font-bold text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
                <LogOut size={16} /><span>{t('logout')}</span>
              </motion.button>
            )}
            <motion.button onClick={handleSave} disabled={saving}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50"
              style={{ background: saved ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <AnimatePresence mode="wait">
                {saved
                  ? <motion.span key="saved" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2"><CheckCircle size={16} /><span>{t('saved')}</span></motion.span>
                  : <motion.span key="save" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2"><Save size={16} /><span>{t('save')}</span></motion.span>
                }
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section icon={User} title={t('profileSection')}>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 rtl:space-x-reverse mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>A</div>
                <div>
                  <p className="text-sm font-bold text-white">{profile.name}</p>
                  <p className="text-xs text-slate-500">{t('mallAdmin')}</p>
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors">{t('changeAvatar')}</button>
                </div>
              </div>
              {[{ label: t('fullName'), key: 'name' as const }, { label: t('emailAddress'), key: 'email' as const }, { label: t('mallName'), key: 'mall' as const }].map(field => (
                <div key={field.key}>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{field.label}</label>
                  <input value={profile[field.key]}
                    onChange={e => setProfile(p => ({ ...p, [field.key]: e.target.value }))}
                    className="mt-1.5 w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">{t('languageLabel')}</label>
                  <select 
                    value={lang}
                    onChange={(e) => setLang(e.target.value as 'en' | 'ar')}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option className="bg-[#0a0a0b]" value="en">{t('english')}</option>
                    <option className="bg-[#0a0a0b]" value="ar">{t('arabic')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">{t('theme')}</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option className="bg-[#0a0a0b]" value="dark">{t('darkSpace')}</option>
                    <option className="bg-[#0a0a0b]" value="light">{t('lightMode')}</option>
                  </select>
                </div>
              </div>
            </div>
          </Section>

          <Section icon={Bell} title={t('notificationsSection')}>
            <Toggle label={t('emailNotif')} desc={t('emailNotifDesc')} checked={notifs.email} onChange={(v: boolean) => setNotifs(n => ({ ...n, email: v }))} />
            <Toggle label={t('pushNotif')} desc={t('pushNotifDesc')} checked={notifs.push} onChange={(v: boolean) => setNotifs(n => ({ ...n, push: v }))} />
            <Toggle label={t('aiAlerts')} desc={t('aiAlertsDesc')} checked={notifs.ai} onChange={(v: boolean) => setNotifs(n => ({ ...n, ai: v }))} />
            <Toggle label={t('weeklyReport')} desc={t('weeklyReportDesc')} checked={notifs.weekly} onChange={(v: boolean) => setNotifs(n => ({ ...n, weekly: v }))} />
          </Section>

          <Section icon={Shield} title={t('securitySection')}>
            <div className="space-y-4">
              {[{ label: t('currentPassword') }, { label: t('newPassword') }].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</label>
                  <input type="password" placeholder="••••••••"
                    className="mt-1.5 w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              ))}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <p className="text-sm font-bold text-indigo-300">{t('roleLabel')}: {t('mallAdmin')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('roleDesc')}</p>
              </div>
            </div>
          </Section>

          <Section icon={Database} title={t('systemSection')}>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('aiThreshold')}</label>
                  <span className="text-sm font-extrabold text-indigo-400">{threshold}%</span>
                </div>
                <input type="range" min="50" max="99" value={threshold} onChange={e => setThreshold(Number(e.target.value))}
                  className="w-full accent-indigo-500" />
                <p className="text-xs text-slate-500 mt-1.5">{t('aiThresholdDesc')}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('refreshRate')}</label>
                <select className="mt-1.5 w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <option>{t('realtime')}</option>
                  <option>{t('every30s')}</option>
                  <option>{t('everyMinute')}</option>
                </select>
              </div>
              <div className="p-4 rounded-xl flex items-center space-x-3 rtl:space-x-reverse"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-300">{t('dbConnected')}</p>
                  <p className="text-xs text-slate-500">{t('lastSync')}</p>
                </div>
              </div>
            </div>
          </Section>
        </div>
    </AppShell>
  );
};

export default Settings;
