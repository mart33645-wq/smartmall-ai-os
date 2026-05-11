import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  BrainCircuit,
  Loader2,
  MessageSquare,
  Mic,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { useLang } from '../i18n/LangContext';
import { formatCurrency, formatNumber, formatPercent } from '../i18n/format';
import type {
  AssistantAction,
  AssistantChatResponse,
  AssistantConversation,
  AssistantExecution,
  AssistantMessage,
  AssistantStatus,
  AssistantSystemAnalysis,
} from '../lib/assistantApi';
import { assistantApi } from '../lib/assistantApi';
import { offlineAssistantAnalysis, offlineAssistantChat, offlineAssistantStatus } from '../lib/demoData';
import { chatWithFallback, streamChat } from '../lib/streamingApi';
import { useStore } from '../store/useStore';

const STORAGE_KEY = 'smartmall_assistant_conversation';

type ActiveTab = 'chat' | 'analysis';
type AssistantWidgetVariant = 'floating' | 'page';

type AssistantWidgetProps = {
  variant?: AssistantWidgetVariant;
  prefillMessage?: string | null;
};

const readStoredConversationId = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStoredConversationId = (conversationId: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (conversationId) {
      window.localStorage.setItem(STORAGE_KEY, conversationId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
};

const mergeActions = (current: AssistantAction[], next: AssistantAction[]) => {
  const map = new Map<string, AssistantAction>();
  [...current, ...next].forEach((action) => {
    map.set(action.id, action);
  });
  return Array.from(map.values());
};

const toAssistantMessage = (response: AssistantChatResponse): AssistantMessage => ({
  role: 'assistant',
  content: response.answer,
  created_at: response.generated_at,
  payload: {
    analysis: response.analysis,
    suggestions: response.suggestions,
    follow_up_questions: response.follow_up_questions,
    action_ids: response.suggested_actions.map((action) => action.id),
    executed_actions: response.executed_actions,
  },
});

const toSystemMessage = (execution: AssistantExecution): AssistantMessage => ({
  role: 'system',
  content: execution.summary,
  created_at: execution.generated_at,
  payload: { action_id: execution.action_id, title: execution.title },
});

const pickStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const pickExecutions = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is AssistantExecution => !!item && typeof item === 'object') : [];

const pickActionIds = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const providerBadgeLabel = (status: AssistantStatus | null, lang: 'ar' | 'en') => {
  if (status?.provider_label) {
    return status.provider_label;
  }
  if (status?.provider.includes('openai')) {
    return 'OpenAI';
  }
  if (status?.provider.includes('gemini')) {
    return 'Gemini';
  }
  return lang === 'ar' ? 'احتياطي' : 'Fallback';
};

const metricLabel = (key: string, lang: 'ar' | 'en') => {
  const labels: Record<string, { ar: string; en: string }> = {
    total_revenue: { ar: 'إجمالي الإيراد', en: 'Total revenue' },
    total_visitors: { ar: 'إجمالي الزوار', en: 'Total visitors' },
    total_shops: { ar: 'إجمالي المحلات', en: 'Total shops' },
    shops_at_risk: { ar: 'المحلات المعرضة للخطر', en: 'Shops at risk' },
    pending_tasks: { ar: 'المهام النشطة', en: 'Pending tasks' },
    overdue_tasks: { ar: 'المهام المتأخرة', en: 'Overdue tasks' },
    parking_occupancy: { ar: 'إشغال المواقف', en: 'Parking occupancy' },
    avg_shop_performance: { ar: 'متوسط أداء المحلات', en: 'Average shop performance' },
    assistant_live: { ar: 'المساعد مفعل', en: 'Assistant live' },
  };

  return labels[key]?.[lang] || key.replaceAll('_', ' ');
};

const metricValue = (key: string, value: number | string | boolean, lang: 'ar' | 'en') => {
  if (typeof value === 'boolean') {
    return value ? (lang === 'ar' ? 'نعم' : 'Yes') : lang === 'ar' ? 'لا' : 'No';
  }

  if (typeof value === 'number') {
    if (key.includes('revenue')) {
      return formatCurrency(value, lang);
    }
    if (key.includes('occupancy') || key.includes('performance')) {
      return formatPercent(value, lang);
    }
    return formatNumber(value, lang);
  }

  return value;
};

const moduleScoreTone = (score: number) => {
  if (score >= 85) {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100';
  }
  if (score >= 70) {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
  }
  return 'border-rose-500/20 bg-rose-500/10 text-rose-100';
};

export const AssistantWidget = ({ variant = 'floating', prefillMessage = null }: AssistantWidgetProps) => {
  const { t, lang } = useLang();
  const location = useLocation();
  const user = useStore((state) => state.user);
  const triggerRefresh = useStore((state) => state.triggerRefresh);
  const isPage = variant === 'page';
  const [isOpen, setIsOpen] = useState(isPage);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [analysis, setAnalysis] = useState<AssistantSystemAnalysis | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(readStoredConversationId);
  const [actionCatalog, setActionCatalog] = useState<AssistantAction[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [autoRunActions, setAutoRunActions] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const streamCancelRef = useRef<(() => void) | null>(null);

  const panelVisible = isPage || isOpen;
  const hasBackendSession = Boolean(user?.token);
  const providerBadge = providerBadgeLabel(status, lang);
  const introLine =
    lang === 'ar'
      ? 'اسأل عن النظام أو عن أي موضوع تقني أو تجاري أو عام.'
      : 'Ask about the platform or any general tech, business, or everyday topic.';
  const inputPlaceholder =
    lang === 'ar'
      ? 'اسأل عن العمليات أو أي سؤال عام تريد إجابته...'
      : 'Ask about operations or any general question you want answered...';
  const starterPrompts = [
    t('assistantPromptWeakest'),
    t('assistantPromptRisk'),
    t('assistantPromptTasks'),
    lang === 'ar'
      ? 'اشرح لي فكرة تقنية أو تجارية بلغة بسيطة.'
      : 'Explain a technical or business idea in simple terms.',
  ];

  useEffect(() => {
    if (isPage) {
      setIsOpen(true);
    }
  }, [isPage]);

  useEffect(() => {
    if (prefillMessage) {
      setInput(prefillMessage);
    }
  }, [prefillMessage]);

  useEffect(() => {
    if (!hasBackendSession) {
      setStatus(offlineAssistantStatus(lang));
      return;
    }

    assistantApi
      .getStatus()
      .then(setStatus)
      .catch(() => {
        setStatus(offlineAssistantStatus(lang));
      });
  }, [hasBackendSession, lang, t]);

  useEffect(() => {
    writeStoredConversationId(conversationId);
  }, [conversationId]);

  useEffect(
    () => () => {
      streamCancelRef.current?.();
      streamCancelRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!hasBackendSession || !panelVisible || !conversationId || messages.length > 0) {
      return;
    }

    setLoadingConversation(true);
    assistantApi
      .getConversation(conversationId)
      .then((conversation: AssistantConversation) => {
        setMessages(conversation.messages);
      })
      .catch(() => {
        setConversationId(null);
      })
      .finally(() => {
        setLoadingConversation(false);
      });
  }, [conversationId, hasBackendSession, messages.length, panelVisible]);

  useEffect(() => {
    if (!panelVisible || activeTab !== 'analysis' || loadingAnalysis || analysis) {
      return;
    }

    void refreshAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, analysis, panelVisible, loadingAnalysis]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const refreshAnalysis = async () => {
    if (!hasBackendSession) {
      setAnalysis(offlineAssistantAnalysis(lang));
      return;
    }
    setLoadingAnalysis(true);
    try {
      const nextAnalysis = await assistantApi.getSystemAnalysis(lang);
      setAnalysis(nextAnalysis);
      setActionCatalog((current) => mergeActions(current, nextAnalysis.suggested_actions));
    } catch {
      setAnalysis(offlineAssistantAnalysis(lang));
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSend = async (messageOverride?: string) => {
    const nextMessage = (messageOverride ?? input).trim();
    if (!nextMessage || sending) {
      return;
    }

    streamCancelRef.current?.();
    streamCancelRef.current = null;

    const optimisticUserMessage: AssistantMessage = {
      role: 'user',
      content: nextMessage,
      created_at: new Date().toISOString(),
      payload: {},
    };

    setMessages((current) => [...current, optimisticUserMessage]);
    setInput('');
    setSending(true);

    const token = user?.token;
    const useStream =
      hasBackendSession && Boolean(status?.llm_enabled) && !autoRunActions && Boolean(token);

    if (useStream && token) {
      let accumulated = '';
      const streamKey = `stream-${Date.now()}`;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          payload: { streaming: true, streamKey },
        },
      ]);

      streamCancelRef.current = streamChat(
        {
          message: nextMessage,
          conversation_id: conversationId,
          allow_automation: false,
          lang,
        },
        {
          onToken: (tok) => {
            accumulated += tok;
            setMessages((current) =>
              current.map((m) =>
                m.payload && (m.payload as Record<string, unknown>).streamKey === streamKey ? { ...m, content: accumulated } : m,
              ),
            );
          },
          onDone: (data) => {
            setConversationId(data.conversation_id);
            setMessages((current) =>
              current.map((m) =>
                m.payload && (m.payload as Record<string, unknown>).streamKey === streamKey
                  ? {
                      ...m,
                      content: accumulated,
                      payload: {
                        provider: data.provider,
                        streamed: true,
                        memory_entries: data.memory_entries,
                      },
                    }
                  : m,
              ),
            );
            streamCancelRef.current = null;
            setSending(false);
          },
          onError: async (err) => {
            toast.error(typeof err === 'string' && err ? err : t('assistantRequestFailed'));
            setMessages((current) =>
              current.filter((m) => (m.payload as Record<string, unknown> | undefined)?.streamKey !== streamKey),
            );
            try {
              const response = await chatWithFallback({
                message: nextMessage,
                conversation_id: conversationId,
                allow_automation: false,
                lang,
              });
              setConversationId(response.conversation_id);
              setActionCatalog((current) => mergeActions(current, response.suggested_actions));
              setMessages((current) => [...current, toAssistantMessage(response)]);
            } catch {
              setMessages((current) => [
                ...current,
                {
                  role: 'system',
                  content: t('assistantRequestFailed'),
                  created_at: new Date().toISOString(),
                  payload: {},
                },
              ]);
            } finally {
              streamCancelRef.current = null;
              setSending(false);
            }
          },
        },
        token,
      );
      return;
    }

    try {
      const response = hasBackendSession
        ? await assistantApi.chat({
            message: nextMessage,
            conversation_id: conversationId,
            allow_automation: autoRunActions,
            lang,
          })
        : offlineAssistantChat(nextMessage, lang);

      setConversationId(response.conversation_id);
      setActionCatalog((current) => mergeActions(current, response.suggested_actions));
      setMessages((current) => [...current, toAssistantMessage(response)]);

      if (response.executed_actions.length > 0) {
        toast.success(`${t('assistantActionExecuted')} (${formatNumber(response.executed_actions.length, lang)})`);
        void refreshAnalysis();
        triggerRefresh();
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'system',
          content: t('assistantRequestFailed'),
          created_at: new Date().toISOString(),
          payload: {},
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (actionId: string) => {
    setActionLoadingId(actionId);
    try {
      const execution = await assistantApi.executeAction(actionId, lang);
      setMessages((current) => [...current, toSystemMessage(execution)]);
      toast.success(execution.summary);
      void refreshAnalysis();
      triggerRefresh();
    } catch {
      toast.error(t('assistantActionFailed'));
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isPage && location.pathname === '/assistant') {
    return null;
  }

  const panel = (
    <motion.div
      key={isPage ? 'assistant-page-panel' : 'assistant-panel'}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      className={`flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#08101f]/97 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${
        isPage
          ? 'h-[min(860px,calc(100vh-13rem))] w-full'
          : 'h-[min(820px,calc(100vh-2rem))] w-[min(560px,calc(100vw-1.5rem))]'
      }`}
    >
      <div className="relative overflow-hidden border-b border-white/8 px-5 pb-4 pt-5">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_50%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.3),transparent_45%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">
              <Sparkles size={12} />
              {t('assistantPanelEyebrow')}
            </div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
              {isPage
                ? lang === 'ar'
                  ? 'مساحة عمل المساعد الذكي'
                  : 'AI assistant workspace'
                : t('assistantPanelTitle')}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {status?.llm_enabled ? `${t('assistantPanelSubtitleLive')} ${status.model}` : t('assistantPanelSubtitleFallback')}
            </p>
            <p className="mt-2 text-sm text-slate-300">{introLine}</p>
          </div>
          {!isPage ? (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-2xl border border-white/8 bg-white/5 p-2 text-slate-400 transition hover:text-white"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          {([
            ['chat', t('assistantTabChat')],
            ['analysis', t('assistantTabAnalysis')],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl border px-4 py-2 text-xs font-bold transition ${
                activeTab === tab
                  ? 'border-cyan-400/20 bg-cyan-400/15 text-cyan-100'
                  : 'border-transparent bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}

          <div className="ms-auto flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
            <span className={`h-2 w-2 rounded-full ${status?.llm_enabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {providerBadge}
          </div>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <>
          <div className="border-b border-white/6 px-5 py-3">
            <label className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">{t('assistantAutomationTitle')}</p>
                <p className="text-xs text-slate-400">{t('assistantAutomationDescription')}</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoRunActions((value) => !value)}
                className={`relative h-7 w-12 rounded-full transition ${autoRunActions ? 'bg-cyan-500' : 'bg-white/10'}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${autoRunActions ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </label>
          </div>

          <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {loadingConversation ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_45%),rgba(255,255,255,0.03)] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                      <BrainCircuit size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{t('assistantWelcomeTitle')}</p>
                      <p className="text-xs text-slate-400">{introLine}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSend(prompt)}
                      className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-400/25 hover:bg-cyan-400/8"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const analysisItems = pickStringArray(message.payload.analysis);
                const suggestions = pickStringArray(message.payload.suggestions);
                const followUps = pickStringArray(message.payload.follow_up_questions);
                const actionIds = pickActionIds(message.payload.action_ids);
                const executed = pickExecutions(message.payload.executed_actions);
                const relatedActions = actionCatalog.filter((action) => actionIds.includes(action.id));
                const bubbleTone =
                  message.role === 'assistant'
                    ? 'border-cyan-400/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(99,102,241,0.08))]'
                    : message.role === 'system'
                      ? 'border-amber-400/25 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(245,158,11,0.08))]'
                      : 'border-white/10 bg-white/5';
                const roleLabel =
                  message.role === 'assistant'
                    ? t('assistantLauncherTitle')
                    : message.role === 'system'
                      ? lang === 'ar'
                        ? 'النظام'
                        : 'System'
                      : lang === 'ar'
                        ? 'أنت'
                        : 'You';

                return (
                  <motion.div
                    key={`${message.created_at}-${index}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-[1.6rem] border p-4 ${bubbleTone}`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {message.role === 'assistant' ? <Bot size={12} /> : message.role === 'system' ? <Wand2 size={12} /> : <MessageSquare size={12} />}
                      {roleLabel}
                    </div>
                    <div className="mb-3">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ ...props }) => <p className="mb-2 text-sm leading-relaxed text-slate-100 last:mb-0" {...props} />,
                          strong: ({ ...props }) => <strong className="font-bold text-white" {...props} />,
                          a: ({ ...props }) => <a className="font-medium text-cyan-400 hover:underline" {...props} />,
                          ul: ({ ...props }) => <ul className="mb-3 list-inside list-disc space-y-1 text-sm text-slate-200" {...props} />,
                          ol: ({ ...props }) => <ol className="mb-3 list-inside list-decimal space-y-1 text-sm text-slate-200" {...props} />,
                          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                          code: ({ inline, children, ...props }: { inline?: boolean; children?: ReactNode }) =>
                            inline ? (
                              <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-cyan-200" {...props}>
                                {children}
                              </code>
                            ) : (
                              <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/50 shadow-inner">
                                <code className="block overflow-x-auto p-3 font-mono text-xs text-slate-300" {...props}>
                                  {children}
                                </code>
                              </div>
                            ),
                          table: ({ ...props }) => (
                            <div className="mb-3 overflow-x-auto rounded-xl border border-white/10 bg-white/4">
                              <table className="w-full text-left text-sm text-slate-200" {...props} />
                            </div>
                          ),
                          th: ({ ...props }) => <th className="border-b border-white/10 bg-white/5 px-3 py-2 font-bold text-white" {...props} />,
                          td: ({ ...props }) => <td className="border-b border-white/5 px-3 py-2" {...props} />,
                          h1: ({ ...props }) => <h1 className="mb-2 mt-4 text-lg font-black text-white" {...props} />,
                          h2: ({ ...props }) => <h2 className="mb-2 mt-4 text-base font-bold text-white" {...props} />,
                          h3: ({ ...props }) => <h3 className="mb-2 mt-3 text-sm font-bold text-slate-200" {...props} />,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {analysisItems.length ? (
                      <div className="mt-4 space-y-2">
                        {analysisItems.map((item) => (
                          <div key={item} className="rounded-2xl bg-white/5 px-3 py-2 text-xs text-slate-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {suggestions.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {suggestions.map((item) => (
                          <span key={item} className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {relatedActions.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {relatedActions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => void handleAction(action.id)}
                            disabled={actionLoadingId === action.id}
                            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-bold text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-60"
                          >
                            {actionLoadingId === action.id ? <Loader2 size={12} className="animate-spin" /> : action.title}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {executed.length ? (
                      <div className="mt-4 space-y-2">
                        {executed.map((execution) => (
                          <div key={`${execution.action_id}-${execution.generated_at}`} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">{execution.title}</div>
                            <p className="mt-1 text-xs text-slate-200">{execution.summary}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {followUps.length ? (
                      <div className="mt-4 space-y-2">
                        {followUps.map((question) => (
                          <button
                            key={question}
                            type="button"
                            onClick={() => setInput(question)}
                            className="w-full rounded-2xl border border-white/8 bg-white/4 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-white/15 hover:text-white"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </motion.div>
                );
              })
            )}
          </div>

          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void handleSend();
            }}
            className="border-t border-white/8 px-5 py-4"
          >
            <div className="rounded-[1.6rem] border border-white/10 bg-white/4 p-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={isPage ? 4 : 3}
                placeholder={inputPlaceholder}
                className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">
                  {autoRunActions ? t('assistantAutomationEnabled') : t('assistantChatOnly')}
                  {!autoRunActions && status?.llm_enabled ? (
                    <span className="ms-2 text-cyan-400/90">· SSE</span>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={lang === 'ar' ? 'إدخال صوتي' : 'Voice input'}
                    onClick={() => {
                      const g = globalThis as unknown as {
                        SpeechRecognition?: new () => {
                          lang: string;
                          start: () => void;
                          onresult: ((ev: unknown) => void) | null;
                          onerror: (() => void) | null;
                        };
                        webkitSpeechRecognition?: new () => {
                          lang: string;
                          start: () => void;
                          onresult: ((ev: unknown) => void) | null;
                          onerror: (() => void) | null;
                        };
                      };
                      const SR = g.SpeechRecognition || g.webkitSpeechRecognition;
                      if (!SR) {
                        toast.error(lang === 'ar' ? 'المتصفح لا يدعم الإدخال الصوتي' : 'Voice input is not supported in this browser');
                        return;
                      }
                      const rec = new SR();
                      rec.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
                      rec.onresult = (event: unknown) => {
                        const e = event as { results?: { [k: number]: { [j: number]: { transcript?: string } } } };
                        const text = (e.results?.[0]?.[0]?.transcript ?? '').trim();
                        if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
                      };
                      rec.onerror = () => {
                        toast.error(lang === 'ar' ? 'تعذر التقاط الصوت' : 'Could not capture speech');
                      };
                      rec.start();
                    }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:text-white"
                  >
                    <Mic size={16} />
                  </button>
                  <button
                    type="submit"
                    disabled={sending || input.trim().length === 0}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {t('assistantSend')}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </>
      ) : (
        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('assistantSystemAnalysis')}</p>
              <p className="mt-1 text-sm text-slate-300">{t('assistantSystemAnalysisDescription')}</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshAnalysis()}
              className="rounded-2xl border border-white/8 bg-white/5 p-2 text-slate-300 transition hover:text-white"
            >
              {loadingAnalysis ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          </div>

          {!analysis ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_35%),rgba(255,255,255,0.04)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300">{t('assistantExecutiveSummary')}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-100">{analysis.executive_summary}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(analysis.key_metrics).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{metricLabel(key, lang)}</p>
                    <p className="mt-2 text-lg font-black text-white">{metricValue(key, value, lang)}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {analysis.modules.map((module) => (
                  <div key={module.module} className="rounded-[1.5rem] border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{module.module}</p>
                        <p className="mt-1 text-xs text-slate-400">{module.summary}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${moduleScoreTone(module.score)}`}>
                        {formatNumber(module.score, lang)}
                      </span>
                    </div>
                    {module.issue ? <p className="mt-3 text-xs text-amber-100">{module.issue}</p> : null}
                  </div>
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-white/8 bg-white/4 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('assistantImprovementOpportunities')}</p>
                <div className="mt-3 space-y-2">
                  {analysis.improvement_opportunities.map((item) => (
                    <div key={item} className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/8 bg-white/4 p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <Play size={12} />
                  {t('assistantSafeActions')}
                </div>
                <div className="grid gap-2 xl:grid-cols-2">
                  {analysis.suggested_actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => void handleAction(action.id)}
                      disabled={actionLoadingId === action.id}
                      className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left transition hover:border-cyan-400/20 hover:bg-cyan-400/8 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{action.title}</p>
                          <p className="mt-1 text-xs text-slate-400">{action.description}</p>
                        </div>
                        {actionLoadingId === action.id ? <Loader2 size={16} className="animate-spin text-cyan-300" /> : <Play size={16} className="text-cyan-300" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  if (isPage) {
    return <div className="w-full">{panel}</div>;
  }

  return (
    <div className="fixed bottom-5 left-5 z-50">
      <AnimatePresence>
        {!panelVisible ? (
          <motion.button
            key="assistant-launcher"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 rounded-[1.75rem] border border-cyan-500/30 bg-[#060c18]/95 px-5 py-4 text-left shadow-[0_24px_80px_rgba(34,211,238,0.25)] backdrop-blur-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-cyan-600">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black tracking-tight text-white">{t('assistantLauncherTitle')}</p>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                  {providerBadge}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{introLine}</p>
            </div>
          </motion.button>
        ) : (
          panel
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssistantWidget;
