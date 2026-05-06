import { motion } from 'framer-motion';
import { Bot, BrainCircuit, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { AppShell } from '../components/AppShell';
import AssistantWidget from '../components/AssistantWidget';
import { useLang } from '../i18n/LangContext';

type AssistantRouteState = {
  prompt?: string;
};

export default function AssistantPage() {
  const { lang } = useLang();
  const location = useLocation();
  const routeState = (location.state as AssistantRouteState | null) || null;

  const highlights = [
    {
      icon: Bot,
      title: lang === 'ar' ? 'إجابات داخل وخارج النظام' : 'Answers inside and outside the system',
      body:
        lang === 'ar'
          ? 'اسأل عن بيانات المشروع أو أي سؤال عام في التقنية أو الأعمال أو التخطيط.'
          : 'Ask about project data or any general tech, business, or planning topic.',
    },
    {
      icon: BrainCircuit,
      title: lang === 'ar' ? 'تحليل وتشغيل' : 'Analysis and operations',
      body:
        lang === 'ar'
          ? 'راجع المحلات والمهام والمواقف ثم شغّل الإجراءات الآمنة من نفس المكان.'
          : 'Review shops, tasks, and parking, then launch safe actions from one workspace.',
    },
    {
      icon: Sparkles,
      title: lang === 'ar' ? 'مساحة أكبر للشات' : 'Larger chat workspace',
      body:
        lang === 'ar'
          ? 'الواجهة هنا أوسع وأوضح ومناسبة للمحادثات الطويلة والعمل المتواصل.'
          : 'This workspace is wider, clearer, and better for longer conversations and focused work.',
    },
  ];

  return (
    <AppShell mainClassName="custom-scrollbar flex flex-col gap-8">
      <motion.header
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,480px)] xl:items-end"
      >
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-cyan-300">
            <Bot size={12} />
            {lang === 'ar' ? 'المساعد الذكي' : 'AI assistant'}
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            {lang === 'ar' ? 'مساحة العمل الذكية' : 'Intelligent workspace'}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            {lang === 'ar'
              ? 'الشات هنا صار أكبر وأنظف، ويركز على الأسئلة التشغيلية داخل المشروع وكذلك الأسئلة العامة خارج النظام.'
              : 'The chat is now larger and cleaner, with support for operational questions inside the project and general questions outside the system.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {highlights.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-[1.6rem] border border-white/8 bg-white/5 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-200">
                <Icon size={18} />
              </div>
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="mt-2 text-xs leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </motion.header>

      <AssistantWidget variant="page" prefillMessage={routeState?.prompt ?? null} />
    </AppShell>
  );
}
