import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Toaster } from 'react-hot-toast';

import { LangProvider } from './i18n/LangContext';
import { translations } from './i18n/cleanTranslations';
import { getStoredLang } from './i18n/runtimeText';
import { useStore } from './store/useStore';
import { api } from './lib/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useWebSocket } from './lib/useWebSocket';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const TaskManager = lazy(() => import('./pages/TaskManager'));
const ParkingSystem = lazy(() => import('./pages/ParkingSystem'));
const Shops = lazy(() => import('./pages/Shops'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AssistantPage = lazy(() => import('./pages/Alerts'));
const Settings = lazy(() => import('./pages/Settings'));
const AssistantWidget = lazy(() => import('./components/AssistantWidget'));

function App() {
  useWebSocket();
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const didAutoLoginRef = useRef(false);
  const [booting, setBooting] = useState(true);
  const bootLang = getStoredLang();

  useEffect(() => {
    if (user?.token) {
      setBooting(false);
      return;
    }

    if (didAutoLoginRef.current) {
      setBooting(false);
      return;
    }

    didAutoLoginRef.current = true;

    void (async () => {
      try {
        const formData = new FormData();
        formData.append('username', 'admin');
        formData.append('password', 'admin123');

        const { data } = await api.post('/api/auth/login', formData);
        setUser({
          username: data.username,
          role: data.role,
          full_name: data.full_name,
          token: data.access_token,
        });
      } catch (error) {
        console.error('Auto-login failed:', error);
      } finally {
        setBooting(false);
      }
    })();
  }, [setUser, user?.token]);

  return (
    <LangProvider>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)' },
        }}
      />
      {booting ? (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="text-sm font-bold text-slate-400">{translations[bootLang].startingSmartMall}</div>
        </div>
      ) : (
        <Router>
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                  <div className="text-sm font-bold text-slate-400">{translations[bootLang].startingSmartMall}</div>
                </div>
              }
            >
              <Routes>
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="/tasks" element={<TaskManager />} />
                <Route path="/assistant" element={<AssistantPage />} />
                <Route path="/parking" element={<ParkingSystem />} />
                <Route path="/shops" element={<Shops />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/alerts" element={<Navigate to="/assistant" replace />} />
                <Route path="/settings" element={<Settings onLogout={() => setUser(null)} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <AssistantWidget />
            </Suspense>
          </ErrorBoundary>
        </Router>
      )}
    </LangProvider>
  );
}

export default App;
