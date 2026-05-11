import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  DollarSign,
  Edit2,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  TrendingUp,
  WandSparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { AppShell } from '../components/AppShell';
import { useLang } from '../i18n/LangContext';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  localizeCategory,
} from '../i18n/format';
import { api } from '../lib/api';
import { demoShops } from '../lib/demoData';
import { useStore, type Shop } from '../store/useStore';

type ShopFormState = {
  name: string;
  category: string;
  floor: number;
  rent_amount: number;
  daily_revenue: number;
  visitor_count: number;
  performance_score: number;
};

const defaultFormState: ShopFormState = {
  name: '',
  category: 'Fashion',
  floor: 1,
  rent_amount: 5000,
  daily_revenue: 2400,
  visitor_count: 360,
  performance_score: 82,
};

const buildShopInsight = (
  shop: Pick<Shop, 'daily_revenue' | 'visitor_count' | 'performance_score' | 'is_at_risk'>,
  lang: 'ar' | 'en',
) => {
  const performanceLift = (shop.performance_score - 72) / 160;
  const demandShift = shop.is_at_risk ? -0.08 : 0.07;
  const predictedRevenue = Math.max(0, Math.round(shop.daily_revenue * (1 + performanceLift + demandShift)));
  const predictedVisitors = Math.max(0, Math.round(shop.visitor_count * (shop.is_at_risk ? 0.95 : 1.1)));

  if (shop.is_at_risk || shop.performance_score < 60) {
    return {
      healthTone: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
      healthLabel: lang === 'ar' ? 'مراجعة حرجة' : 'Critical review',
      recommendation:
        lang === 'ar'
          ? 'نوصي بتخفيض إيجار محدود مع حملة تنشيط قصيرة لاستعادة الحركة.'
          : 'Recommend a short retention campaign and a temporary rent adjustment.',
      predictedRevenue,
      predictedVisitors,
    };
  }

  if (shop.performance_score < 80) {
    return {
      healthTone: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
      healthLabel: lang === 'ar' ? 'يحتاج متابعة' : 'Needs attention',
      recommendation:
        lang === 'ar'
          ? 'الفرصة الأفضل هي تحسين العرض التجاري ورفع الجذب داخل الواجهة الأمامية.'
          : 'Best next move is merchandising refinement and stronger storefront pull.',
      predictedRevenue,
      predictedVisitors,
    };
  }

  return {
    healthTone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
    healthLabel: lang === 'ar' ? 'مستقر' : 'Healthy',
    recommendation:
      lang === 'ar'
        ? 'المحل مؤهل لزيادة عائد الإيجار تدريجيًا مع الحفاظ على جودة الخدمة.'
        : 'This shop can support a measured rent uplift while preserving experience quality.',
    predictedRevenue,
    predictedVisitors,
  };
};

const buildShopCardAccent = (shop: Pick<Shop, 'is_at_risk' | 'performance_score'>) => {
  if (shop.is_at_risk || shop.performance_score < 60) {
    return {
      glow: 'from-rose-500/22 via-rose-500/6 to-transparent',
      ring: 'border-rose-400/25',
      icon: 'bg-rose-500/12 text-rose-200',
    };
  }

  if (shop.performance_score < 80) {
    return {
      glow: 'from-amber-500/18 via-amber-500/5 to-transparent',
      ring: 'border-amber-400/20',
      icon: 'bg-amber-500/12 text-amber-100',
    };
  }

  return {
    glow: 'from-cyan-500/18 via-indigo-500/6 to-transparent',
    ring: 'border-cyan-400/20',
    icon: 'bg-cyan-500/12 text-cyan-200',
  };
};

interface ShopMetricTileProps {
  icon: typeof Store;
  label: string;
  tone: string;
  value: string;
}

const ShopMetricTile = ({ icon: Icon, label, tone, value }: ShopMetricTileProps) => (
  <div className="rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
      <Icon size={13} className={tone} />
      {label}
    </div>
    <p className="mt-3 text-lg font-black text-white">{value}</p>
  </div>
);

interface ShopActionButtonProps {
  disabled?: boolean;
  icon: typeof Store;
  label: string;
  tone: string;
  onClick: () => void;
}

const ShopActionButton = ({ disabled, icon: Icon, label, tone, onClick }: ShopActionButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${tone}`}
  >
    <Icon size={15} />
    {label}
  </button>
);

const Shops = () => {
  const { t, lang, isRTL } = useLang();
  const { shops, setShops, isLoading, setLoading, refreshVersion } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [form, setForm] = useState<ShopFormState>(defaultFormState);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Shop[]>('/api/shops/');
      setShops(data);
    } catch {
      toast.error(t('fetchShopsFailed'));
      setShops(demoShops);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setShops, t]);

  useEffect(() => {
    void fetchShops();
  }, [fetchShops, refreshVersion]);

  useEffect(() => {
    if (!editingShop) {
      setForm(defaultFormState);
      return;
    }

    setForm({
      name: editingShop.name,
      category: editingShop.category,
      floor: editingShop.floor,
      rent_amount: editingShop.rent_amount,
      daily_revenue: editingShop.daily_revenue,
      visitor_count: editingShop.visitor_count,
      performance_score: editingShop.performance_score,
    });
  }, [editingShop]);

  const filteredShops = shops.filter((shop) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return true;
    }

    return [shop.name, shop.category, localizeCategory(shop.category, lang)]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const portfolioRevenue = shops.reduce((sum, shop) => sum + shop.rent_amount, 0);
  const portfolioTraffic = shops.reduce((sum, shop) => sum + shop.visitor_count, 0);
  const atRiskShops = shops.filter((shop) => shop.is_at_risk).length;
  const topShop = [...shops].sort((a, b) => b.performance_score - a.performance_score)[0];
  const portfolioPredictedRevenue = shops.reduce((sum, shop) => sum + buildShopInsight(shop, lang).predictedRevenue, 0);

  const draftPreview = buildShopInsight(
    {
      daily_revenue: form.daily_revenue,
      visitor_count: form.visitor_count,
      performance_score: form.performance_score,
      is_at_risk: editingShop?.is_at_risk || form.performance_score < 60 || form.daily_revenue < 1800,
    },
    lang,
  );

  const openCreatePanel = () => {
    setEditingShop(null);
    setForm(defaultFormState);
    setIsPanelOpen(true);
  };

  const openEditPanel = (shop: Shop) => {
    setEditingShop(shop);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setEditingShop(null);
  };

  const handleFieldChange = <K extends keyof ShopFormState>(key: K, value: ShopFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreateOrUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      if (editingShop) {
        await api.put(`/api/shops/${editingShop.id}`, form);
        toast.success(t('shopUpdated'));
      } else {
        await api.post('/api/shops/', form);
        toast.success(t('shopCreated'));
      }

      closePanel();
      await fetchShops();
    } catch {
      toast.error(t('operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/shops/${id}`);
      toast.success(t('shopDeleted'));
      setDeleteId(null);
      await fetchShops();
    } catch {
      toast.error(t('deleteFailed'));
    }
  };

  const handleOptimizeRent = async (shopId: number) => {
    setActionLoadingId(shopId);
    try {
      await api.post(`/api/shops/${shopId}/optimize-rent`);
      toast.success(t('shopRentOptimized'));
      await fetchShops();
    } catch {
      toast.error(t('operationFailed'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRiskCheck = async (shopId: number) => {
    setActionLoadingId(shopId);
    try {
      await api.post(`/api/shops/${shopId}/risk-check`);
      toast.success(t('shopRiskChecked'));
      await fetchShops();
    } catch {
      toast.error(t('operationFailed'));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <AppShell mainClassName="custom-scrollbar relative">
      <header className="mb-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.35em] text-cyan-300">{t('shopsControlHubTitle')}</p>
          <h1 className="text-4xl font-black tracking-tight text-white">
            {t('shopsControlHubTitle')} <span className="text-cyan-300">{t('shopsControlHubTitleSpan')}</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">{t('shopsInsightHeadline')}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="glass flex items-center gap-3 rounded-2xl border border-white/10 px-5 py-3">
            <Search size={18} className="text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('findShop')}
              className="w-72 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <button
            onClick={openCreatePanel}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 font-bold text-white transition hover:brightness-110"
          >
            <Plus size={18} />
            {t('newShopBtn')}
          </button>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-[2rem] border border-white/10 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{t('totalRentYield')}</p>
          <p className="mt-3 text-3xl font-black text-white">{formatCurrency(portfolioRevenue, lang)}</p>
        </div>
        <div className="glass rounded-[2rem] border border-white/10 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{t('liveOccupancy')}</p>
          <p className="mt-3 text-3xl font-black text-white">
            {shops.length ? formatPercent(((shops.length - atRiskShops) / shops.length) * 100, lang) : formatPercent(0, lang)}
          </p>
        </div>
        <div className="glass rounded-[2rem] border border-white/10 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{t('atRisk')}</p>
          <p className="mt-3 text-3xl font-black text-rose-400">{formatNumber(atRiskShops, lang)}</p>
        </div>
        <div className="glass rounded-[2rem] border border-white/10 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{t('highestTraffic')}</p>
          <p className="mt-3 text-2xl font-black text-emerald-300">{topShop?.name || '-'}</p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <div className="glass overflow-hidden rounded-[2.2rem] border border-white/10">
            <div className="flex flex-col gap-5 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.14),transparent_35%),rgba(255,255,255,0.03)] p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-cyan-200">
                  <Store size={14} />
                  {lang === 'ar' ? 'عرض المحلات' : 'Shop grid'}
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {lang === 'ar' ? 'بطاقات أوضح وسريعة القراءة' : 'Cleaner cards with faster scanning'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {lang === 'ar'
                    ? `يتم عرض ${formatNumber(filteredShops.length, lang)} محل داخل شبكة مضغوطة لتسهيل المقارنة بين الأداء والمخاطر والإجراءات من نفس الشاشة.`
                    : `${formatNumber(filteredShops.length, lang)} shops are shown in a compact grid so performance, risk, and actions are easier to compare.`}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-500">{t('projectedRevenue')}</p>
                  <p className="mt-2 text-xl font-black text-white">{formatCurrency(portfolioPredictedRevenue, lang)}</p>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-500">{t('shopTrafficLabel')}</p>
                  <p className="mt-2 text-xl font-black text-white">{formatNumber(portfolioTraffic, lang)}</p>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-[2.5rem] border border-white/5 bg-white/5 p-6">
              <LoadingSkeleton count={4} />
            </div>
          ) : filteredShops.length === 0 ? (
            <EmptyState
              title={t('noShopsFound')}
              description={t('noShopsDesc')}
              type={searchTerm ? 'search' : 'data'}
              action={openCreatePanel}
              actionText={t('newShopBtn')}
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <AnimatePresence>
                {filteredShops.map((shop) => {
                  const insight = buildShopInsight(shop, lang);
                  const cardAccent = buildShopCardAccent(shop);
                  const performanceTone =
                    shop.performance_score >= 85
                      ? 'text-emerald-300'
                      : shop.performance_score >= 70
                        ? 'text-amber-200'
                        : 'text-rose-200';

                  return (
                    <motion.article
                      key={shop.id}
                      layout
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -14 }}
                      className={`glass-hover noise relative overflow-hidden rounded-[2.2rem] border ${cardAccent.ring} bg-white/[0.035] p-5`}
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cardAccent.glow}`} />
                      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

                      <div className="relative">
                        <div className="mb-5 flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-4">
                            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl ${cardAccent.icon}`}>
                              <Store size={24} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-2xl font-black tracking-tight text-white">{shop.name}</h2>
                                {shop.is_at_risk ? <AlertCircle size={18} className="text-rose-400" /> : null}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">
                                  {localizeCategory(shop.category, lang)}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">
                                  {lang === 'ar' ? `الطابق ${formatNumber(shop.floor, lang)}` : `Floor ${formatNumber(shop.floor, lang)}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${insight.healthTone}`}>
                            {insight.healthLabel}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <ShopMetricTile
                            icon={DollarSign}
                            label={t('monthlyRent')}
                            tone="text-cyan-200"
                            value={formatCurrency(shop.rent_amount, lang)}
                          />
                          <ShopMetricTile
                            icon={TrendingUp}
                            label={t('shopRevenueLabel')}
                            tone="text-emerald-300"
                            value={formatCurrency(shop.daily_revenue, lang)}
                          />
                          <ShopMetricTile
                            icon={Activity}
                            label={t('shopTrafficLabel')}
                            tone="text-amber-200"
                            value={formatNumber(shop.visitor_count, lang)}
                          />
                          <ShopMetricTile
                            icon={BarChart3}
                            label={t('score')}
                            tone={performanceTone}
                            value={formatPercent(shop.performance_score, lang)}
                          />
                        </div>

                        <div className="mt-5 rounded-[1.8rem] border border-white/8 bg-black/20 p-5">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                              <Bot size={14} />
                              {t('shopAiPrediction')}
                            </div>
                            <p className={`text-sm font-black ${performanceTone}`}>{formatPercent(shop.performance_score, lang)}</p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-slate-500">{t('projectedRevenue')}</p>
                              <p className="mt-1 text-lg font-black text-white">{formatCurrency(insight.predictedRevenue, lang)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">{t('todayVisitors')}</p>
                              <p className="mt-1 text-lg font-black text-white">{formatNumber(insight.predictedVisitors, lang)}</p>
                            </div>
                          </div>

                          <div className="mb-3 mt-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white">
                            <BarChart3 size={14} className="text-indigo-300" />
                            {t('shopAiRecommendation')}
                          </div>
                          <p className="text-sm leading-6 text-slate-300">{insight.recommendation}</p>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <ShopActionButton
                            icon={Edit2}
                            label={t('editShopPanel')}
                            tone="border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/30 hover:text-white"
                            onClick={() => openEditPanel(shop)}
                          />
                          <ShopActionButton
                            disabled={actionLoadingId === shop.id}
                            icon={ShieldCheck}
                            label={t('shopRunRiskCheck')}
                            tone="border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                            onClick={() => handleRiskCheck(shop.id)}
                          />
                          <ShopActionButton
                            disabled={actionLoadingId === shop.id}
                            icon={WandSparkles}
                            label={t('shopOptimizeRent')}
                            tone="border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                            onClick={() => handleOptimizeRent(shop.id)}
                          />
                          <ShopActionButton
                            icon={Trash2}
                            label={t('deleteShopTitle')}
                            tone="border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                            onClick={() => setDeleteId(shop.id)}
                          />
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <div className="glass rounded-[2.2rem] border border-white/10 p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200">
                <Bot size={20} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-300">{t('shopPortfolioPulse')}</p>
                <h3 className="mt-1 text-xl font-black text-white">{t('shopAiPortfolioSummary')}</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                <p className="text-xs text-slate-500">{t('projectedRevenue')}</p>
                <p className="mt-2 text-2xl font-black text-white">{formatCurrency(portfolioPredictedRevenue, lang)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                <p className="text-xs text-slate-500">{t('shopTrafficLabel')}</p>
                <p className="mt-2 text-2xl font-black text-white">{formatNumber(portfolioTraffic, lang)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                <p className="text-xs text-slate-500">{t('highestTraffic')}</p>
                <p className="mt-2 text-lg font-black text-emerald-300">{topShop?.name || '-'}</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-[2.2rem] border border-white/10 p-6">
            <div className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">
              <TrendingUp size={14} />
              {t('shopKpiSnapshot')}
            </div>

            <div className="space-y-4">
              {filteredShops.slice(0, 4).map((shop) => {
                const insight = buildShopInsight(shop, lang);
                return (
                  <div key={shop.id} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{shop.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{localizeCategory(shop.category, lang)}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${insight.healthTone}`}>
                        {insight.healthLabel}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                      <span>{t('projectedRevenue')}</span>
                      <span className="font-bold text-white">{formatCurrency(insight.predictedRevenue, lang)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {isPanelOpen ? (
          <motion.aside
            initial={{ x: isRTL ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRTL ? '-100%' : '100%' }}
            className={`fixed inset-y-0 z-[100] h-full w-full max-w-[520px] overflow-y-auto bg-[#08101f]/98 p-8 shadow-[-30px_0_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${isRTL ? 'left-0 border-r' : 'right-0 border-l'} border-white/10`}
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">{t('shopControlPanel')}</p>
                <h2 className="mt-2 text-3xl font-black text-white">
                  {editingShop ? t('editShopPanel') : t('newShopBtn')}
                </h2>
              </div>
              <button
                onClick={closePanel}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-400 transition hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6 rounded-[2rem] border border-cyan-400/15 bg-cyan-500/5 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-200">
                  <Activity size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">{t('shopAiPrediction')}</p>
                  <p className="text-sm text-slate-300">{draftPreview.recommendation}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-xs text-slate-500">{t('projectedRevenue')}</p>
                  <p className="mt-2 text-lg font-black text-white">{formatCurrency(draftPreview.predictedRevenue, lang)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-xs text-slate-500">{t('todayVisitors')}</p>
                  <p className="mt-2 text-lg font-black text-white">{formatNumber(draftPreview.predictedVisitors, lang)}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="space-y-5">
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('shopNameLabel')}</label>
                <input
                  value={form.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition focus:border-cyan-400/40"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('categoryLabel')}</label>
                  <select
                    value={form.category}
                    onChange={(event) => handleFieldChange('category', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition focus:border-cyan-400/40"
                  >
                    {['Fashion', 'Electronics', 'Dining', 'Entertainment', 'Grocery', 'Other'].map((category) => (
                      <option key={category} value={category} className="bg-[#08101f]">
                        {localizeCategory(category, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('floorLabel')}</label>
                  <input
                    type="number"
                    min={1}
                    value={form.floor}
                    onChange={(event) => handleFieldChange('floor', Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('rentLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.rent_amount}
                    onChange={(event) => handleFieldChange('rent_amount', Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('shopRevenueLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.daily_revenue}
                    onChange={(event) => handleFieldChange('daily_revenue', Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('shopTrafficLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.visitor_count}
                    onChange={(event) => handleFieldChange('visitor_count', Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('score')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.performance_score}
                    onChange={(event) => handleFieldChange('performance_score', Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-[1.8rem] bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-4 text-lg font-black text-white transition hover:brightness-110"
              >
                <DollarSign size={18} />
                {editingShop ? t('updateShopBtn') : t('newShopBtn')}
              </button>
            </form>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteId !== null}
        title={t('deleteShopTitle')}
        message={t('deleteShopMsg')}
        onConfirm={() => void handleDelete(deleteId!)}
        onCancel={() => setDeleteId(null)}
        confirmText={t('deletePermanently')}
      />
    </AppShell>
  );
};

export default Shops;
