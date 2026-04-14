import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Map as MapIcon, ShoppingBag, Coffee, Car, Navigation, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LangContext';
import { apiUrl } from '../lib/api';

interface PublicShop {
  id: number;
  name: string;
  category: string;
  floor: number;
  gate_hint: string;
}

interface Offer {
  title: string;
  subtitle: string;
  discount_pct: number;
  shop_id: number;
}

export const CustomerApp: React.FC = () => {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState('search');
  const [query, setQuery] = useState('');
  const [shops, setShops] = useState<PublicShop[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [parking, setParking] = useState<{ occupancy_pct: number; available: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [sRes, oRes, pRes] = await Promise.all([
          fetch(apiUrl('/api/public/shops')),
          fetch(apiUrl('/api/public/offers')),
          fetch(apiUrl('/api/public/parking')),
        ]);
        if (!sRes.ok || !oRes.ok || !pRes.ok) throw new Error('bad status');
        const sJson = await sRes.json();
        const oJson = await oRes.json();
        const pJson = await pRes.json();
        if (!cancelled) {
          setShops(sJson.shops || []);
          setOffers(oJson.offers || []);
          setParking({
            occupancy_pct: pJson.occupancy_pct,
            available: pJson.available,
            total: pJson.total,
          });
        }
      } catch {
        if (!cancelled) setErr('تعذر تحميل بيانات المول. تأكد أن الخادم يعمل.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        String(s.floor).includes(q),
    );
  }, [shops, query]);

  const categories = [
    { id: 'fashion', icon: <ShoppingBag size={20} />, label: 'أزياء', filter: 'Fashion' },
    { id: 'food', icon: <Coffee size={20} />, label: 'مطاعم', filter: 'Dining' },
    { id: 'parking', icon: <Car size={20} />, label: 'مواقف', filter: '' },
  ];

  const applyCategory = (filter: string) => {
    if (!filter) {
      setActiveTab('parking');
      return;
    }
    setQuery(filter);
    setActiveTab('search');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24">
      <header className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent italic">
            SmartMall
          </h1>
          <div className="flex gap-2 items-center">
            <Link
              to="/"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/30"
            >
              لوحة التحكم
            </Link>
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-full text-indigo-600 dark:text-indigo-400">
              <Star size={20} />
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-12 pr-6 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
          />
        </div>
        {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
        {loading && <p className="text-slate-500 text-xs mt-2">جاري التحميل…</p>}
      </header>

      <section className="p-6 overflow-x-auto flex gap-4 no-scrollbar">
        {categories.map((cat) => (
          <motion.button
            key={cat.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => applyCategory(cat.filter)}
            className="flex flex-col items-center gap-2 min-w-[80px]"
          >
            <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 border border-slate-200 dark:border-slate-800">
              {cat.icon}
            </div>
            <span className="text-xs font-medium">{cat.label}</span>
          </motion.button>
        ))}
      </section>

      {activeTab === 'parking' && parking && (
        <section className="px-6 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="font-bold text-lg mb-2">مواقف السيارات</h2>
            <p className="text-sm text-slate-500 mb-4">
              إشغال {parking.occupancy_pct}% · متبقي {parking.available} من {parking.total}
            </p>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, parking.occupancy_pct)}%` }}
              />
            </div>
          </div>
        </section>
      )}

      <section className="px-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg">المحلات</h2>
          <span className="text-indigo-600 text-sm font-medium">{filtered.length}</span>
        </div>

        <div className="grid gap-4">
          {filtered.map((s) => (
            <motion.div
              key={s.id}
              whileHover={{ y: -3 }}
              className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4"
            >
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 text-lg font-black">
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate">{s.name}</h3>
                <p className="text-xs text-slate-500">
                  {s.category} · الطابق {s.floor} · {s.gate_hint}
                </p>
              </div>
              <button
                type="button"
                className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl shrink-0"
                title="Navigate"
              >
                <Navigation size={18} />
              </button>
            </motion.div>
          ))}
        </div>

        {offers.length > 0 && (
          <>
            <h2 className="font-bold text-lg pt-4">عروض مخصصة</h2>
            <div className="grid gap-3">
              {offers.slice(0, 6).map((o, i) => (
                <div
                  key={`${o.shop_id}-${i}`}
                  className="p-4 rounded-2xl bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-indigo-500/20"
                >
                  <p className="font-bold text-sm">{o.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{o.subtitle}</p>
                  <p className="text-indigo-600 text-xs font-black mt-2">خصم حتى {o.discount_pct}%</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <motion.div className="fixed bottom-28 left-6 right-6" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <Link
          to="/shops"
          className="w-full block text-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl shadow-2xl font-bold"
        >
          <span className="inline-flex items-center justify-center gap-3">
            <MapIcon size={20} />
            استكشف كامل المحلات (لوحة الإدارة)
          </span>
        </Link>
      </motion.div>

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-6 z-50">
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'search' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Search size={22} />
          <span className="text-[10px] font-bold">استكشف</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'map' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <MapIcon size={22} />
          <span className="text-[10px] font-bold">الخريطة</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('parking')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'parking' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Car size={22} />
          <span className="text-[10px] font-bold">سيارتي</span>
        </button>
      </nav>
    </div>
  );
};
