import type { Lang } from './cleanTranslations';

const runtimeMessages: Record<Lang, Record<string, string>> = {
  ar: {
    'AI detected 25% increase in foot traffic near Gate 2.': 'رصد النظام ارتفاعًا بنسبة 25% في حركة الزوار قرب البوابة 2.',
    'Sushi Express revenue below trend. AI suggests promotion.': 'إيرادات سوشي إكسبرس أقل من الاتجاه المتوقع. يوصي النظام بعرض ترويجي.',
    'Level 2 nearing capacity. Activating valet routing.': 'الطابق 2 يقترب من السعة القصوى. يجري تفعيل توجيه خدمة صف السيارات.',
    'Aisle C: Unidentified object detected by neural camera.': 'الممر C: تم رصد جسم غير معروف عبر الكاميرا الذكية.',
    'Optimizing HVAC in Food Court to save 5% energy.': 'يتم تحسين التكييف في منطقة المطاعم لتوفير 5% من الطاقة.',
    'Alert:': 'تنبيه:',
  },
  en: {
    'AI detected 25% increase in foot traffic near Gate 2.': 'AI detected 25% increase in foot traffic near Gate 2.',
    'Sushi Express revenue below trend. AI suggests promotion.': 'Sushi Express revenue below trend. AI suggests promotion.',
    'Level 2 nearing capacity. Activating valet routing.': 'Level 2 nearing capacity. Activating valet routing.',
    'Aisle C: Unidentified object detected by neural camera.': 'Aisle C: Unidentified object detected by neural camera.',
    'Optimizing HVAC in Food Court to save 5% energy.': 'Optimizing HVAC in Food Court to save 5% energy.',
    'Alert:': 'Alert:',
  },
};

export const getStoredLang = (): Lang => {
  if (typeof window === 'undefined') {
    return 'ar';
  }

  const stored = window.localStorage.getItem('smartmall_lang');
  return stored === 'en' ? 'en' : 'ar';
};

export const translateRuntimeText = (value: string, lang: Lang) =>
  runtimeMessages[lang][value] || value;
