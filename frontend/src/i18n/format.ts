import type { Lang } from './cleanTranslations';

const localeByLang: Record<Lang, string> = {
  ar: 'ar-EG',
  en: 'en-US',
};

const categoryMap: Record<string, { ar: string; en: string }> = {
  fashion: { ar: 'أزياء', en: 'Fashion' },
  apparel: { ar: 'ملابس', en: 'Apparel' },
  electronics: { ar: 'إلكترونيات', en: 'Electronics' },
  dining: { ar: 'مطاعم', en: 'Dining' },
  fnb: { ar: 'مطاعم', en: 'Dining' },
  grocery: { ar: 'بقالة', en: 'Grocery' },
  entertainment: { ar: 'ترفيه', en: 'Entertainment' },
  other: { ar: 'أخرى', en: 'Other' },
};

const taskStatusMap: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  'in progress': { ar: 'قيد التنفيذ', en: 'In progress' },
  completed: { ar: 'مكتملة', en: 'Completed' },
};

const priorityMap: Record<string, { ar: string; en: string }> = {
  high: { ar: 'عالية', en: 'High' },
  medium: { ar: 'متوسطة', en: 'Medium' },
  low: { ar: 'منخفضة', en: 'Low' },
};

const alertTypeMap: Record<string, { ar: string; en: string }> = {
  critical: { ar: 'حرج', en: 'Critical' },
  warning: { ar: 'تحذير', en: 'Warning' },
  info: { ar: 'معلومة', en: 'Info' },
  success: { ar: 'نجاح', en: 'Success' },
  normal: { ar: 'طبيعي', en: 'Normal' },
};

const roleMap: Record<string, { ar: string; en: string }> = {
  admin: { ar: 'مدير النظام', en: 'System Admin' },
  manager: { ar: 'مدير المول', en: 'Mall Manager' },
  owner: { ar: 'مالك المحل', en: 'Shop Owner' },
  analyst: { ar: 'محلل', en: 'Analyst' },
  staff: { ar: 'موظف', en: 'Staff' },
};

const parkingTypeMap: Record<string, { ar: string; en: string }> = {
  standard: { ar: 'عادي', en: 'Standard' },
  ev: { ar: 'كهربائي', en: 'EV' },
  disabled: { ar: 'ذوي الاحتياجات', en: 'Accessible' },
};

export const getLocale = (lang: Lang) => localeByLang[lang];

export const formatNumber = (
  value: number,
  lang: Lang,
  options?: Intl.NumberFormatOptions,
) => new Intl.NumberFormat(getLocale(lang), { numberingSystem: 'latn', ...options }).format(value);

export const formatCurrency = (
  value: number,
  lang: Lang,
  currency = 'EGP',
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat(getLocale(lang), {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    ...options,
  }).format(value);

export const formatPercent = (
  value: number,
  lang: Lang,
  maximumFractionDigits = 0,
) =>
  new Intl.NumberFormat(getLocale(lang), {
    style: 'percent',
    numberingSystem: 'latn',
    maximumFractionDigits,
  }).format(value / 100);

export const formatDateTime = (
  value: string | Date | null | undefined,
  lang: Lang,
  options?: Intl.DateTimeFormatOptions,
) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(getLocale(lang), {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
    ...options,
  }).format(date);
};

export const formatTime = (
  value: string | Date | null | undefined,
  lang: Lang,
  options?: Intl.DateTimeFormatOptions,
) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(getLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn',
    ...options,
  }).format(date);
};

const localizeFromMap = (
  value: string | null | undefined,
  lang: Lang,
  map: Record<string, { ar: string; en: string }>,
) => {
  if (!value) {
    return '';
  }

  const key = value.toLowerCase().trim();
  return map[key]?.[lang] || value;
};

export const localizeCategory = (value: string, lang: Lang) =>
  localizeFromMap(value, lang, categoryMap);

export const localizeTaskStatus = (value: string, lang: Lang) =>
  localizeFromMap(value, lang, taskStatusMap);

export const localizePriority = (value: string, lang: Lang) =>
  localizeFromMap(value, lang, priorityMap);

export const localizeAlertType = (value: string, lang: Lang) =>
  localizeFromMap(value, lang, alertTypeMap);

export const localizeParkingType = (value: string, lang: Lang) =>
  localizeFromMap(value, lang, parkingTypeMap);

export const localizeRole = (value: string, lang: Lang) =>
  localizeFromMap(value, lang, roleMap);
