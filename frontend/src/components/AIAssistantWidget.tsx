import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Send, X } from 'lucide-react';

import { useLang } from '../i18n/LangContext';
import { api } from '../lib/api';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
}

export const AIAssistantWidget = () => {
  const { lang, t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: lang === 'ar'
        ? 'مرحبًا! اسألني عن الإيرادات أو المواقف أو التنبيهات الحالية.'
        : 'Hello! Ask me about revenue, parking, or active alerts.',
      isBot: true,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        text: lang === 'ar'
          ? 'مرحبًا! اسألني عن الإيرادات أو المواقف أو التنبيهات الحالية.'
          : 'Hello! Ask me about revenue, parking, or active alerts.',
        isBot: true,
      },
    ]);
  }, [lang]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    setMessages((prev) => [...prev, { id: `${Date.now()}`, text: trimmed, isBot: false }]);
    setInput('');
    setIsTyping(true);

    try {
      const { data } = await api.post('/api/ai-assistant/chat', { message: trimmed });
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-bot`,
          text: data.response || (lang === 'ar' ? 'تعذر توليد رد مناسب الآن.' : 'Unable to generate a response right now.'),
          isBot: true,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          text: lang === 'ar'
            ? 'تعذر الاتصال بالمساعد الذكي حاليًا.'
            : 'Unable to reach the assistant right now.',
          isBot: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-600 text-white shadow-2xl"
      >
        {isOpen ? <X size={22} /> : <Bot size={22} />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            className="fixed bottom-24 right-6 z-50 flex h-[32rem] w-[24rem] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/95 shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/5 bg-white/5 px-5 py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/20">
                <Bot size={18} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-white">SmartMall AI</h3>
                <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-400">
                  {lang === 'ar' ? 'مساعد مباشر' : 'Live Assistant'}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      message.isBot
                        ? 'rounded-tl-none border border-white/10 bg-white/5 text-slate-100'
                        : 'rounded-tr-none bg-indigo-600 text-white'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-tl-none border border-white/10 bg-white/5 px-4 py-3">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:240ms]" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-white/5 p-4">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSend()}
                placeholder={t('search')}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400/50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
