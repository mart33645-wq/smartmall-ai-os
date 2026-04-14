/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { translations } from './cleanTranslations';
import type { Lang, TranslationKey } from './cleanTranslations';

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LangContext = createContext<LangContextType>({
  lang: 'ar',
  setLang: () => {},
  t: (k) => k,
  isRTL: true,
});

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') {
      return 'ar';
    }

    const storedLang = window.localStorage.getItem('smartmall_lang');
    return storedLang === 'en' || storedLang === 'ar' ? storedLang : 'ar';
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
    window.localStorage.setItem('smartmall_lang', l);
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey): string => translations[lang][key] || translations.en[key] || key;

  return (
    <LangContext.Provider value={{ lang, setLang, t, isRTL: lang === 'ar' }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
