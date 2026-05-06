import { Bell, Database, LogOut, Save, Shield, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';

import { AppShell } from '../components/AppShell';
import { useLang } from '../i18n/LangContext';
import { localizeRole } from '../i18n/format';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';

interface ToggleProps {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const Toggle = ({ label, desc, checked, onChange }: ToggleProps) => (
  <div className="flex items-center justify-between border-b border-white/5 py-4 last:border-0">
    <div className="me-4 min-w-0 flex-1">
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </div>
    <motion.button
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.92 }}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-white/10'}`}
    >
      <motion.span
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-lg"
      />
    </motion.button>
  </div>
);

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: ReactNode;
}) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[2rem] border border-white/10 p-6">
    <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-white">
      <Icon size={18} className="text-cyan-300" />
      {title}
    </h2>
    {children}
  </motion.div>
);

type Notifs = { email: boolean; push: boolean; ai: boolean; weekly: boolean };

const Settings = ({ onLogout }: { onLogout?: () => void }) => {
  const { t, lang, setLang } = useLang();
  const setUser = useStore((state) => state.setUser);
  const authUser = useStore((state) => state.user);
  const [notifs, setNotifs] = useState<Notifs>({ email: true, push: true, ai: true, weekly: false });
  const [profile, setProfile] = useState({ name: '', email: '', mall: 'SmartMall Central' });
  const [saved, setSaved] = useState(false);
  const [threshold, setThreshold] = useState(85);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  const [passwords, setPasswords] = useState({ current: '', next: '' });

  const applyTheme = (nextTheme: string) => {
    setTheme(nextTheme);
    document.documentElement.classList.toggle('light', nextTheme === 'light');
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await api.get<{
          username: string;
          role: string;
          full_name: string;
          preferences?: {
            notifs?: Notifs;
            aiThreshold?: number;
            mallName?: string;
            theme?: string;
            lang?: 'ar' | 'en';
          };
        }>('/api/auth/me');

        setProfile({
          name: data.full_name || data.username,
          email: `${data.username}@mall.local`,
          mall: data.preferences?.mallName || 'SmartMall Central',
        });
        if (data.preferences?.notifs) {
          setNotifs(data.preferences.notifs);
        }
        if (typeof data.preferences?.aiThreshold === 'number') {
          setThreshold(data.preferences.aiThreshold);
        }
        if (data.preferences?.theme) {
          applyTheme(data.preferences.theme);
        }
      } catch {
        if (authUser) {
          setProfile({
            name: authUser.full_name || authUser.username,
            email: `${authUser.username}@mall.local`,
            mall: 'SmartMall Central',
          });
        }
      }
    };

    void loadProfile();
  }, [authUser]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const payload = {
        full_name: profile.name,
        preferences: {
          notifs,
          aiThreshold: threshold,
          mallName: profile.mall,
          theme,
          lang,
        },
        password: passwords.next || undefined,
      };

      await api.patch('/api/auth/me', payload);
      if (authUser) {
        setUser({ ...authUser, full_name: profile.name });
      }
      setPasswords({ current: '', next: '' });
      setSaved(true);
      toast.success(t('saved'));
      window.setTimeout(() => setSaved(false), 2200);
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell onLogout={onLogout}>
      <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">{t('settingsTitle')}</h1>
          <p className="mt-2 text-sm text-slate-400">{t('settingsSub')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onLogout ? (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-5 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
            >
              <LogOut size={16} />
              {t('logout')}
            </button>
          ) : null}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <AnimatePresence mode="wait">
              {saved ? (
                <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <Save size={16} />
                  {t('saved')}
                </motion.span>
              ) : (
                <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <Save size={16} />
                  {saving ? t('save') : t('save')}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.header>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={User} title={t('profileSection')}>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 text-2xl font-black text-white">
              {(profile.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{profile.name}</p>
              <p className="mt-1 text-xs text-slate-500">{localizeRole(authUser?.role || 'admin', lang)}</p>
              <p className="mt-1 text-xs text-slate-500">{t('avatarGeneratedFromName')}</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: t('fullName'), key: 'name' as const },
              { label: t('emailAddress'), key: 'email' as const },
              { label: t('mallName'), key: 'mall' as const },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{field.label}</label>
                <input
                  value={profile[field.key]}
                  onChange={(event) => setProfile((current) => ({ ...current, [field.key]: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('languageLabel')}</label>
              <select
                value={lang}
                onChange={(event) => setLang(event.target.value as 'ar' | 'en')}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30"
              >
                <option value="ar" className="bg-[#0f1726]">{t('arabic')}</option>
                <option value="en" className="bg-[#0f1726]">{t('english')}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('theme')}</label>
              <select
                value={theme}
                onChange={(event) => applyTheme(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30"
              >
                <option value="dark" className="bg-[#0f1726]">{t('darkSpace')}</option>
                <option value="light" className="bg-[#0f1726]">{t('lightMode')}</option>
              </select>
            </div>
          </div>
        </Section>

        <Section icon={Bell} title={t('notificationsSection')}>
          <Toggle label={t('emailNotif')} desc={lang === 'ar' ? 'استقبال التنبيهات والتقارير على البريد الإلكتروني.' : 'Receive alerts and reports by email.'} checked={notifs.email} onChange={(value) => setNotifs((current) => ({ ...current, email: value }))} />
          <Toggle label={t('pushNotif')} desc={t('pushNotifDesc')} checked={notifs.push} onChange={(value) => setNotifs((current) => ({ ...current, push: value }))} />
          <Toggle label={t('aiAlerts')} desc={t('aiAlertsDesc')} checked={notifs.ai} onChange={(value) => setNotifs((current) => ({ ...current, ai: value }))} />
          <Toggle label={t('weeklyReport')} desc={t('weeklyReportDesc')} checked={notifs.weekly} onChange={(value) => setNotifs((current) => ({ ...current, weekly: value }))} />
        </Section>

        <Section icon={Shield} title={t('securitySection')}>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('currentPassword')}</label>
              <input
                type="password"
                value={passwords.current}
                onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30"
                placeholder={t('passwordPlaceholder')}
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('newPassword')}</label>
              <input
                type="password"
                value={passwords.next}
                onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30"
                placeholder={t('passwordPlaceholder')}
              />
            </div>

            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
              <p className="text-sm font-bold text-cyan-100">
                {t('roleLabel')}: {localizeRole(authUser?.role || 'admin', lang)}
              </p>
              <p className="mt-1 text-xs text-slate-300">{t('roleDesc')}</p>
            </div>
          </div>
        </Section>

        <Section icon={Database} title={t('systemSection')}>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('aiThreshold')}</label>
                <span className="text-sm font-black text-cyan-200">{threshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                className="w-full accent-cyan-400"
              />
              <p className="mt-2 text-xs text-slate-500">{t('aiThresholdDesc')}</p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-sm font-bold text-emerald-100">{t('dbConnected')}</p>
              <p className="mt-1 text-xs text-slate-300">{t('lastSync')}</p>
            </div>
          </div>
        </Section>

        {authUser?.role === 'Admin' ? (
          <Section icon={Shield} title={t('adminUtils')}>
            <p className="mb-4 text-sm text-slate-400">{t('adminUtilsDesc')}</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  if (window.confirm(t('rebuildDatabaseConfirm'))) {
                    await api.post('/api/admin/reset-db');
                    toast.success(t('systemRebuilt'));
                    window.location.reload();
                  }
                }}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
              >
                {t('nuclearReset')}
              </button>
              <button
                onClick={async () => {
                  await api.post('/api/admin/seed-data');
                  toast.success(t('scenarioLoaded'));
                }}
                className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                {t('refreshSeedData')}
              </button>
            </div>
          </Section>
        ) : null}
      </div>
    </AppShell>
  );
};

export default Settings;
