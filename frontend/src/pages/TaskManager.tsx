/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { CheckCircle2, Clock, Plus, BrainCircuit, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../i18n/LangContext';
import { EmptyState } from '../components/EmptyState';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

const statusConfig: any = {
  'Completed': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500', labelKey: 'completed' },
  'In Progress': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-500', labelKey: 'inProgress' },
  'Pending': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500', labelKey: 'pending' },
};

const AddTaskModal = ({ onAdd, onClose, loading }: { onAdd: (t: any) => void; onClose: () => void; loading: boolean }) => {
  const { t } = useLang();
  const [form, setForm] = useState({ title: '', assignee: '', deadline: '', priority: 'Medium', description: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-md rounded-3xl p-6"
        style={{ background: '#0f0f1e', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-extrabold text-white">{t('addTaskTitle')}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          {[
            { label: t('taskTitle'), key: 'title', placeholder: 'مثال: فحص الكاميرات' },
            { label: t('taskAssignee'), key: 'assignee', placeholder: 'مثال: 1 (ID المسؤول)' },
            { label: t('taskDeadline'), key: 'deadline', placeholder: 'YYYY-MM-DD HH:MM:SS' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1.5 w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('taskPriority')}</label>
            <div className="flex gap-2 mt-1.5">
              {[['High', t('high'), '#ef4444'], ['Medium', t('medium'), '#f59e0b'], ['Low', t('low'), '#6366f1']].map(([val, lbl, clr]) => (
                <button key={val} onClick={() => set('priority', val)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${form.priority === val ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  style={form.priority === val ? { background: `${clr}20`, border: `1px solid ${clr}40`, color: clr } : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
        <motion.button onClick={() => onAdd(form)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={loading}
          className="w-full mt-6 py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
          style={{ background: loading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <span>{t('add')} {t('newTask')}</span>}
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

const TaskManager = () => {
  const { t, lang } = useLang();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get('/api/tasks/');
      setTasks(resp.data);
    } catch {
      setTasks([
        { id: 1, title: 'فحص تكييف الجناح الشمالي', assignee: '1', deadline: '2026-03-26 16:00:00', status: 'In Progress', priority: 'High' },
        { id: 2, title: 'مراجعة فواتير Q1 للمستأجرين', assignee: '1', deadline: '2026-03-27 10:00:00', status: 'Pending', priority: 'High' },
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async (formData: any) => {
    setBtnLoading(true);
    try {
      const resp = await api.post('/api/tasks/', {
        title: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        assigned_to: parseInt(formData.assignee) || 1,
        deadline: formData.deadline || '2026-12-31 23:59:59'
      });
      setTasks(prev => [resp.data, ...prev]);
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
    setBtnLoading(false);
  };

  const filtered = filter === 'All' ? tasks : tasks.filter(t => t.status === filter);
  const countByStatus = (s: string) => tasks.filter(t => t.status === s).length;

  return (
    <AppShell>
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">{t('taskManagerTitle')}</h1>
            <p className="text-slate-500 mt-1 text-sm">{t('taskManagerSub')}</p>
          </div>
          <motion.button whileHover={{ scale: 1.03, boxShadow: '0 0 25px rgba(99,102,241,0.4)' }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 rtl:space-x-reverse px-5 py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Plus size={18} /><span>{t('newTask')}</span>
          </motion.button>
        </motion.header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
          </div>
        ) : (
          <>
            <div className="flex space-x-3 rtl:space-x-reverse mb-8">
              {[
                ['All', t('all'), tasks.length],
                ['In Progress', t('inProgress'), countByStatus('In Progress')],
                ['Pending', t('pending'), countByStatus('Pending')],
                ['Completed', t('completed'), countByStatus('Completed')],
              ].map(([key, label, count]) => (
                <button key={key} onClick={() => setFilter(key as string)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${filter === key ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'text-slate-500 border-white/5 hover:border-white/10 hover:text-slate-300'}`}>
                  {label} <span className="opacity-60 ms-1">{count}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 glass rounded-2xl p-2 space-y-1">
                <AnimatePresence mode="popLayout">
                  {filtered.map((task, i) => {
                    const s = statusConfig[task.status] || statusConfig['Pending'];
                    return (
                      <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }} transition={{ delay: i * 0.06 }}
                        whileHover={{ x: 3, backgroundColor: 'rgba(255,255,255,0.04)' }}
                        className="flex items-center space-x-4 rtl:space-x-reverse px-5 py-4 rounded-xl border border-white/5 cursor-pointer transition-all">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg} border ${s.border}`}>
                          {task.status === 'Completed' ? <CheckCircle2 size={16} className="text-emerald-400" />
                            : <Clock size={16} className="text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${task.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'}`}>{task.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{task.assigned_to || t('unassigned')} · {task.deadline}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex-shrink-0 ${s.bg} ${s.text} ${s.border}`}>
                          {t(s.labelKey)}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <EmptyState 
                    title={t('noTasksFound')}
                    description={t('noTasksDesc')}
                    type="data"
                    action={() => setShowModal(true)}
                    actionText={t('newTask')}
                  />
                )}
              </div>

              <div className="space-y-5">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                  className="p-6 rounded-2xl relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <BrainCircuit className="mb-4 text-indigo-400" size={28} />
                  <h3 className="text-lg font-bold text-white mb-2">{t('aiOptimization')}</h3>
                  <p className="text-slate-400 text-sm mb-5">{t('aiOptimizationDesc')}</p>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/10 transition-all">
                    {t('applyAutoPriority')}
                  </motion.button>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                  className="glass rounded-2xl p-6">
                  <h3 className="text-base font-bold text-white mb-5">{t('staffLoad')}</h3>
                  <div className="space-y-4">
                    {[
                      { deptAr: 'الأمن', deptEn: 'Security', load: 92, color: '#ef4444' },
                      { deptAr: 'الصيانة', deptEn: 'Maintenance', load: 78, color: '#f59e0b' },
                      { deptAr: 'الإدارة', deptEn: 'Admin', load: 61, color: '#6366f1' },
                      { deptAr: 'فريق AI', deptEn: 'AI Team', load: 45, color: '#10b981' },
                    ].map(({ deptAr, deptEn, load, color }) => (
                      <div key={deptEn}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-400 font-medium">{lang === 'ar' ? deptAr : deptEn}</span>
                          <span className="text-white font-bold">{load}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${load}%` }}
                            transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      <AnimatePresence>
        {showModal && (
          <AddTaskModal
            onAdd={handleAddTask}
            onClose={() => setShowModal(false)}
            loading={btnLoading}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
};

export default TaskManager;
