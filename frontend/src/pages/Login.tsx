import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Zap } from 'lucide-react';
import type { AxiosError } from 'axios';

import { useLang } from '../i18n/LangContext';
import { localizeRole } from '../i18n/format';
import { api } from '../lib/api';

interface LoginProps {
  onLogin: (userData: { username: string; role: string; full_name: string; token: string }) => void;
}

const demoAccounts: Record<string, { email: string; password: string }> = {
  admin: { email: 'admin@smartmall.ai', password: 'admin123' },
  manager: { email: 'manager@smartmall.ai', password: 'manager123' },
  owner: { email: 'owner@smartmall.ai', password: 'owner123' },
  analyst: { email: 'analyst@smartmall.ai', password: 'analyst123' },
};

const roleIds = ['admin', 'manager', 'owner', 'analyst'] as const;

const Login = ({ onLogin }: LoginProps) => {
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState(demoAccounts.admin.email);
  const [password, setPassword] = useState(demoAccounts.admin.password);
  const [role, setRole] = useState<(typeof roleIds)[number]>('admin');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectRole = (roleId: (typeof roleIds)[number]) => {
    setRole(roleId);
    setEmail(demoAccounts[roleId].email);
    setPassword(demoAccounts[roleId].password);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email.split('@')[0]);
      formData.append('password', password || demoAccounts[role].password);

      const { data } = await api.post('/api/auth/login', formData);
      onLogin({
        username: data.username,
        role: data.role,
        full_name: data.full_name,
        token: data.access_token,
      });
    } catch (errorValue) {
      const errorResponse = errorValue as AxiosError<{ detail?: string }>;
      const detail =
        errorResponse.response?.data?.detail ||
        (lang === 'ar'
          ? 'تعذر الوصول إلى الخادم أو بيانات الدخول غير صحيحة'
          : 'The server is unreachable or the credentials are invalid');
      setError(`${t('loginError')}: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111d]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_35%)]" />

      <div className={`absolute top-6 ${lang === 'ar' ? 'left-6' : 'right-6'}`}>
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:text-white"
        >
          {lang === 'ar' ? t('english') : t('arabic')}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55 }}
        className="relative z-10 mx-4 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">{t('appName')}</h1>
          <p className="mt-2 text-sm text-slate-400">{t('loginSub')}</p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl">
          <div className="mb-6 grid grid-cols-2 gap-2">
            {roleIds.map((roleId) => {
              const active = role === roleId;
              return (
                <button
                  key={roleId}
                  onClick={() => selectRole(roleId)}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                    active
                      ? 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                      : 'border border-white/8 bg-white/4 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {localizeRole(roleId, lang)}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{t('emailAddress')}</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{t('passwordLabel')}</label>
              <div className="relative mt-2">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((value) => !value)}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-200 ${lang === 'ar' ? 'left-3' : 'right-3'}`}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs text-rose-300"
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-3.5 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>{t('loggingIn')}</span>
                </>
              ) : (
                <span>{t('loginButton')}</span>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          {lang === 'ar'
            ? 'منصة تشغيل ذكية للمراكز التجارية مع وصول آمن ومدعوم بالذكاء الاصطناعي'
            : 'Retail operations OS with secure, AI-powered access'}
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
