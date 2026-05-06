import { BrainCircuit, CheckCircle2, Clock, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

import { EmptyState } from '../components/EmptyState';
import { AppShell } from '../components/AppShell';
import { useLang } from '../i18n/LangContext';
import {
  formatDateTime,
  formatNumber,
  localizePriority,
  localizeTaskStatus,
} from '../i18n/format';
import { api } from '../lib/api';

type TaskItem = {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  assigned_to?: number;
  deadline?: string;
};

type TaskForm = {
  title: string;
  assignee: string;
  deadline: string;
  priority: string;
  description: string;
};

const statusConfig = {
  Completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  'In Progress': 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
  Pending: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
} as const;

const buildTaskAiNote = (task: TaskItem, lang: 'ar' | 'en') => {
  if (task.status === 'Completed') {
    return lang === 'ar'
      ? 'تم إنجاز المهمة. يمكن إعادة توزيع السعة على أولويات أعلى.'
      : 'Task is complete. Capacity can be reallocated to higher-impact work.';
  }

  if (task.priority === 'High') {
    return lang === 'ar'
      ? 'يوصي الذكاء الاصطناعي بمتابعة لصيقة لهذه المهمة لأنها مرتبطة بخطر أو موعد قريب.'
      : 'AI recommends close follow-up because this task is tied to risk or a near deadline.';
  }

  return lang === 'ar'
    ? 'يمكن دمج هذه المهمة مع مسار تشغيلي مشابه لتقليل التشتت ورفع الإنجاز.'
    : 'This task can likely be bundled with a similar operational stream to reduce context switching.';
};

const AddTaskModal = ({
  onAdd,
  onClose,
  loading,
}: {
  onAdd: (task: TaskForm) => void;
  onClose: () => void;
  loading: boolean;
}) => {
  const { t, lang } = useLang();
  const [form, setForm] = useState<TaskForm>({
    title: '',
    assignee: '1',
    deadline: '',
    priority: 'Medium',
    description: '',
  });

  const setField = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#0f1726] p-6"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">{t('addTaskTitle')}</h2>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('taskTitle')}</label>
            <input
              value={form.title}
              onChange={(event) => setField('title', event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-400/30"
              placeholder={lang === 'ar' ? 'مثال: فحص حساسات البوابة الشرقية' : 'Example: Inspect east gate sensors'}
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('taskAssignee')}</label>
            <input
              value={form.assignee}
              onChange={(event) => setField('assignee', event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-400/30"
              placeholder={lang === 'ar' ? 'رقم المستخدم' : 'User id'}
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('taskDeadline')}</label>
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(event) => setField('deadline', event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-400/30"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('taskPriority')}</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {['High', 'Medium', 'Low'].map((priority) => {
                const active = form.priority === priority;
                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setField('priority', priority)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                      active
                        ? 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                        : 'border border-white/10 bg-white/4 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {localizePriority(priority, lang)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('aiSuggestion')}</label>
            <textarea
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-400/30"
              placeholder={lang === 'ar' ? 'أضف وصفًا مختصرًا للمهمة أو سبب أهميتها...' : 'Add a short task description or why it matters...'}
            />
          </div>
        </div>

        <button
          onClick={() => onAdd(form)}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-3 font-black text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          {t('newTask')}
        </button>
      </motion.div>
    </motion.div>
  );
};

const TaskManager = () => {
  const { t, lang } = useLang();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'In Progress' | 'Pending' | 'Completed'>('All');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<TaskItem[]>('/api/tasks/');
      setTasks(data);
    } catch {
      toast.error(t('operationFailed'));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async (formData: TaskForm) => {
    setBtnLoading(true);
    try {
      const { data } = await api.post<TaskItem>('/api/tasks/', {
        title: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        assigned_to: Number.parseInt(formData.assignee, 10) || 1,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined,
      });

      setTasks((current) => [data, ...current]);
      setShowModal(false);
      toast.success(t('taskCreated'));
    } catch {
      toast.error(t('operationFailed'));
    } finally {
      setBtnLoading(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const { data } = await api.post<{ optimized: number; tasks: TaskItem[] }>('/api/tasks/optimize-priority');
      setTasks(data.tasks || []);
      toast.success(
        data.optimized > 0
          ? `${t('applyAutoPriority')} (${formatNumber(data.optimized, lang)})`
          : t('saved'),
      );
    } catch {
      toast.error(t('operationFailed'));
    } finally {
      setOptimizing(false);
    }
  };

  const filteredTasks = filter === 'All' ? tasks : tasks.filter((task) => task.status === filter);
  const countByStatus = (status: string) => tasks.filter((task) => task.status === status).length;

  return (
    <AppShell>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">{t('taskManagerTitle')}</h1>
          <p className="mt-2 text-sm text-slate-400">{t('taskManagerSub')}</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-3 text-sm font-black text-white transition hover:brightness-110"
        >
          <Plus size={18} />
          {t('newTask')}
        </button>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={42} className="animate-spin text-cyan-400" />
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap gap-3">
            {[
              ['All', t('all'), tasks.length],
              ['In Progress', t('inProgress'), countByStatus('In Progress')],
              ['Pending', t('pending'), countByStatus('Pending')],
              ['Completed', t('completed'), countByStatus('Completed')],
            ].map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setFilter(key as typeof filter)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  filter === key
                    ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                    : 'border-white/10 bg-white/4 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label} <span className="ms-1 opacity-70">{formatNumber(Number(count), lang)}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_360px]">
            <section className="space-y-4">
              {filteredTasks.length ? (
                <AnimatePresence mode="popLayout">
                  {filteredTasks.map((task, index) => (
                    <motion.article
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
                      className="glass rounded-[1.9rem] border border-white/10 p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex gap-4">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${task.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
                            {task.status === 'Completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className={`text-lg font-black ${task.status === 'Completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
                                {task.title}
                              </h2>
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${statusConfig[task.status as keyof typeof statusConfig] || statusConfig.Pending}`}>
                                {localizeTaskStatus(task.status, lang)}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] font-bold text-slate-300">
                                {localizePriority(task.priority, lang)}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-400">
                              {task.description || buildTaskAiNote(task, lang)}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              <span>{t('taskAssignee')}: {formatNumber(task.assigned_to || 0, lang)}</span>
                              <span>{t('taskDeadline')}: {formatDateTime(task.deadline, lang)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4 xl:max-w-xs">
                          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                            <Sparkles size={13} />
                            {t('aiSuggestion')}
                          </div>
                          <p className="text-sm leading-6 text-slate-300">{buildTaskAiNote(task, lang)}</p>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              ) : (
                <EmptyState
                  title={t('noTasksFound')}
                  description={t('noTasksDesc')}
                  type="data"
                  action={() => setShowModal(true)}
                  actionText={t('newTask')}
                />
              )}
            </section>

            <aside className="space-y-5">
              <div className="rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_35%),rgba(6,182,212,0.05)] p-6">
                <BrainCircuit className="mb-4 text-cyan-200" size={28} />
                <h3 className="text-xl font-black text-white">{t('aiOptimization')}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t('aiOptimizationDesc')}</p>
                <button
                  onClick={() => void handleOptimize()}
                  disabled={optimizing}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white/8 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-white/12 disabled:opacity-60"
                >
                  {optimizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {t('applyAutoPriority')}
                </button>
              </div>

              <div className="glass rounded-[2rem] border border-white/10 p-6">
                <h3 className="mb-5 text-lg font-black text-white">{t('staffLoad')}</h3>
                <div className="space-y-4">
                  {[
                    { ar: 'الأمن', en: 'Security', load: 92, color: '#ef4444' },
                    { ar: 'الصيانة', en: 'Maintenance', load: 78, color: '#f59e0b' },
                    { ar: 'الإدارة', en: 'Administration', load: 61, color: '#6366f1' },
                    { ar: 'فريق الذكاء', en: 'AI Team', load: 45, color: '#10b981' },
                  ].map((item) => (
                    <div key={item.en}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-400">{lang === 'ar' ? item.ar : item.en}</span>
                        <span className="font-bold text-white">{formatNumber(item.load, lang)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.load}%` }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${item.color}, ${item.color}88)` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      <AnimatePresence>
        {showModal ? (
          <AddTaskModal
            onAdd={(task) => void handleAddTask(task)}
            onClose={() => setShowModal(false)}
            loading={btnLoading}
          />
        ) : null}
      </AnimatePresence>
    </AppShell>
  );
};

export default TaskManager;
