import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import { apiUrl } from '../lib/api';

interface LoginProps {
  onLogin: (userData: { username: string; role: string; full_name: string; token: string }) => void;
}

const roles = [
  { id: 'admin', labelKey: 'adminRole' as const, color: '#6366f1' },
  { id: 'manager', labelKey: 'managerRole' as const, color: '#8b5cf6' },
  { id: 'owner', labelKey: 'ownerRole' as const, color: '#10b981' },
  { id: 'analyst', labelKey: 'analystRole' as const, color: '#f59e0b' },
];

const Login = ({ onLogin }: LoginProps) => {
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState('admin@smartmall.ai');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('username', email.split('@')[0]);
      formData.append('password', password || 'admin123');
      
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onLogin({ username: data.username, role: data.role, full_name: data.full_name, token: data.access_token });
      } else {
        let detail = 'Invalid credentials';
        try {
          const errData = await response.json();
          detail = typeof errData.detail === 'string' ? errData.detail : detail;
        } catch {
          /* ignore */
        }
        setError(`Login failed: ${detail}`);
      }
    } catch {
      setError('Cannot reach the API. Is the backend running on port 8000?');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0a0a14' }}>

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

      {/* Language toggle */}
      <div className="absolute top-6 right-6">
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 transition-all hover:text-white"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {lang === 'ar' ? 'English' : 'عربي'}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.4 }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Zap size={28} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-extrabold text-white">{t('appName')}</h1>
          <p className="text-slate-500 mt-2 text-sm">{t('loginSub')}</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {roles.map(r => (
              <motion.button key={r.id} whileTap={{ scale: 0.96 }}
                onClick={() => setRole(r.id)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${role === r.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                style={role === r.id
                  ? { background: `${r.color}20`, border: `1px solid ${r.color}40`, color: r.color }
                  : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }
                }>
                {t(r.labelKey)}
              </motion.button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('emailAddress')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="mt-1.5 w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('newPassword')}</label>
              <div className="relative mt-1.5">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all pr-12"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-red-400 text-xs text-center">{error}</motion.p>
              )}
            </AnimatePresence>

            <motion.button type="submit" disabled={loading}
              whileHover={!loading ? { scale: 1.02, boxShadow: '0 0 30px rgba(99,102,241,0.5)' } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 mt-6 transition-all"
              style={{ background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>{t('loggingIn')}</span></>
                : <span>{t('loginButton')}</span>
              }
            </motion.button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">SmartMall AI OS © 2026 · Powered by AI</p>
      </motion.div>
    </div>
  );
};

export default Login;
