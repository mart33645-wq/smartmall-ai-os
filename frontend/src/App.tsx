import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { LangProvider } from './i18n/LangContext';
import { translations } from './i18n/cleanTranslations';
import { getStoredLang } from './i18n/runtimeText';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useWebSocket } from './lib/useWebSocket';
import { ProtectedRoute } from './components/ProtectedRoute';

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
  const bootLang = getStoredLang();

  return (
    <LangProvider>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)' },
        }}
      />
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
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><TaskManager /></ProtectedRoute>} />
              <Route path="/assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
              <Route path="/parking" element={<ProtectedRoute><ParkingSystem /></ProtectedRoute>} />
              <Route path="/shops" element={<ProtectedRoute><Shops /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/alerts" element={<Navigate to="/assistant" replace />} />
              <Route path="/settings" element={<ProtectedRoute><Settings onLogout={() => undefined} /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <AssistantWidget />
          </Suspense>
        </ErrorBoundary>
      </Router>
    </LangProvider>
  );
}

export default App;
