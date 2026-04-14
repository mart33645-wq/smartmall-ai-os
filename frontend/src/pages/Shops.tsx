
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit2, Trash2, Store,
  AlertCircle, X, Save
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useStore, type Shop } from '../store/useStore';
import { useLang } from '../i18n/LangContext';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

const Shops = () => {
  const { t } = useLang();
  const { shops, setShops, isLoading, setLoading } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/shops');
      setShops(res.data);
    } catch {
      toast.error(t('fetchShopsFailed'));
    } finally {
      setLoading(false);
    }
  }, [setLoading, setShops, t]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData.entries()) as Record<string, string>;
    const shopData = {
      ...rawData,
      floor: Number(rawData.floor),
      rent_amount: Number(rawData.rent_amount),
    };
    
    try {
      if (editingShop) {
        await api.put(`/api/shops/${editingShop.id}`, shopData);
        toast.success(t('shopUpdated'));
      } else {
        await api.post('/api/shops', shopData);
        toast.success(t('shopCreated'));
      }
      fetchShops();
      setIsPanelOpen(false);
    } catch {
      toast.error(t('operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/shops/${id}`);
      toast.success(t('shopDeleted'));
      fetchShops();
    } catch {
      toast.error(t('deleteFailed'));
    }
  };

  return (
    <AppShell mainClassName="custom-scrollbar relative font-inter">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">{t('shopsControlHubTitle')} <span className="text-indigo-500">{t('shopsControlHubTitleSpan')}</span></h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">{t('fullOperationalManagement')}</p>
          </div>
          <div className="flex gap-4">
            <div className="glass flex items-center gap-3 px-6 py-2 rounded-2xl border border-white/5">
              <Search size={18} className="text-slate-500" />
              <input 
                type="text" 
                placeholder={t('findShop')}
                className="bg-transparent border-none outline-none text-sm w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { setEditingShop(null); setIsPanelOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus size={20} />
              {t('newShopBtn')}
            </button>
          </div>
        </header>

        {/* Global Stats bar for Shops */}
        <div className="grid grid-cols-4 gap-6 mb-12">
           <div className="glass p-6 rounded-[2rem] border border-white/5">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('totalRentYield')}</div>
             <div className="text-2xl font-black">$248.5k</div>
           </div>
           <div className="glass p-6 rounded-[2rem] border border-white/5">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('liveOccupancy')}</div>
             <div className="text-2xl font-black">94%</div>
           </div>
           <div className="glass p-6 rounded-[2rem] border border-white/5">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('atRisk')}</div>
             <div className="text-2xl font-black text-rose-500">2</div>
           </div>
           <div className="glass p-6 rounded-[2rem] border border-white/5">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('highestTraffic')}</div>
             <div className="text-2xl font-black text-emerald-400">Zara</div>
           </div>
        </div>

        {/* Shops Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full border border-white/5 rounded-[2.5rem] p-6 bg-white/5">
              <LoadingSkeleton count={3} />
            </div>
          ) : (
          <AnimatePresence>
            {shops.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
              shops.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((shop) => (
                <motion.div 
                  key={shop.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass p-8 rounded-[2.5rem] border border-white/5 group relative hover:border-indigo-500/30 transition-all shadow-[0_8px_32px_-16px_rgba(0,0,0,0.5)]"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 rounded-3xl bg-white/5 text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                      <Store size={32} />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingShop(shop); setIsPanelOpen(true); }} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteId(shop.id)} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-rose-400"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-2xl font-black tracking-tight">{shop.name}</h3>
                      {shop.is_at_risk && <AlertCircle size={20} className="text-rose-500 animate-pulse" />}
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">{shop.category} • Floor {shop.floor}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
                     <div>
                       <span className="text-[10px] font-black text-slate-600 block mb-1">{t('monthlyRent')}</span>
                       <span className="text-sm font-bold text-white">${shop.rent_amount.toLocaleString()}</span>
                     </div>
                     <div>
                       <span className="text-[10px] font-black text-slate-600 block mb-1">{t('visitors')}</span>
                       <span className="text-sm font-bold text-white">{shop.visitor_count}</span>
                     </div>
                     <div>
                       <span className="text-[10px] font-black text-slate-600 block mb-1">{t('score')}</span>
                       <span className={`text-sm font-bold ${shop.performance_score > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                         {shop.performance_score}%
                       </span>
                     </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full">
                <EmptyState 
                  title={t('noShopsFound')}
                  description={t('noShopsDesc')}
                  type={searchTerm ? 'search' : 'data'}
                  action={() => { setEditingShop(null); setIsPanelOpen(true); }}
                  actionText={t('newShopBtn')}
                />
              </div>
            )}
          </AnimatePresence>
          )}
        </div>

        {/* Advanced Side Panel for CRUD */}
        <AnimatePresence>
          {isPanelOpen && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 w-[500px] h-full glass backdrop-blur-3xl border-l border-white/10 z-[100] p-12 shadow-[-40px_0_80px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-3xl font-black tracking-tighter">{editingShop ? t('editShopPanel') : t('addShopPanel')}</h2>
                <button onClick={() => setIsPanelOpen(false)} className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"><X size={24} /></button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('shopNameLabel')}</label>
                  <input name="name" defaultValue={editingShop?.name} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold focus:border-indigo-500/50 outline-none transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('categoryLabel')}</label>
                    <select name="category" defaultValue={editingShop?.category} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold focus:border-indigo-500/50 outline-none appearance-none cursor-pointer">
                      <option className="bg-[#0a0a0b]" value="Fashion">{t('fashion')}</option>
                      <option className="bg-[#0a0a0b]" value="Electronics">{t('electronics')}</option>
                      <option className="bg-[#0a0a0b]" value="Dining">{t('fnb')}</option>
                      <option className="bg-[#0a0a0b]" value="Entertainment">{t('entertainment')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('floorLabel')}</label>
                    <input name="floor" type="number" defaultValue={editingShop?.floor || 1} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold focus:border-indigo-500/50 outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t('rentLabel')}</label>
                  <input name="rent_amount" type="number" defaultValue={editingShop?.rent_amount || 5000} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold focus:border-indigo-500/50 outline-none" />
                </div>

                <div className="pt-8">
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-16 rounded-[2rem] font-bold tracking-tighter text-lg shadow-[0_16px_32px_rgba(79,70,229,0.3)] flex items-center justify-center gap-3 group transition-all">
                    <Save size={20} className="group-hover:scale-110 transition-transform" />
                    {editingShop ? t('updateShopBtn') : t('deployShopBtn')}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        <ConfirmModal 
           isOpen={deleteId !== null} 
           title={t('deleteShopTitle')}
           message={t('deleteShopMsg')}
           onConfirm={() => handleDelete(deleteId!)} 
           onCancel={() => setDeleteId(null)}
           confirmText={t('deletePermanently')}
        />
    </AppShell>
  );
};

export default Shops;
