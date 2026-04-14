import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { LangProvider } from './i18n/LangContext';
import { useStore } from './store/useStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskManager from './pages/TaskManager';
import ParkingSystem from './pages/ParkingSystem';
import Shops from './pages/Shops';
import Analytics from './pages/Analytics';
import { Monitoring } from './pages/Monitoring';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import { CustomerApp } from './pages/CustomerApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { wsUrl } from './lib/api';

const WebSocketListener = () => {
  const addAlert = useStore(state => state.addAlert);
  const updateShop = useStore(state => state.updateShop);
  const removeShop = useStore(state => state.removeShop);
  const resolveAlert = useStore(state => state.resolveAlert);
  const removeAlert = useStore(state => state.removeAlert);
  const mergeParkingSlot = useStore(state => state.mergeParkingSlot);
  const setParkingStats = useStore(state => state.setParkingStats);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    const connect = () => {
      ws = new WebSocket(wsUrl('/ws'));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ALERT' && data.payload) addAlert(data.payload);
          if (data.type === 'SHOP_UPDATE' && data.payload?.id != null) {
            updateShop(data.payload.id, data.payload);
          }
          if (data.type === 'SHOP_DELETED' && data.payload?.id != null) {
            removeShop(data.payload.id);
          }
          if (data.type === 'ALERT_RESOLVED' && data.payload?.id != null) {
            resolveAlert(data.payload.id);
          }
          if (data.type === 'ALERT_DELETED' && data.payload?.id != null) {
            removeAlert(data.payload.id);
          }
          if (data.type === 'PARKING_UPDATE' && data.payload?.slot) {
            mergeParkingSlot(data.payload.slot);
            if (data.payload.stats) setParkingStats(data.payload.stats);
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
      ws.onerror = () => console.warn('WS connection issue – backend may be offline');
      ws.onclose = () => {
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      ws?.close();
    };
  }, [addAlert, mergeParkingSlot, removeAlert, removeShop, resolveAlert, setParkingStats, updateShop]);

  return null;
};

function App() {
  const { user, setUser } = useStore();

  const handleLogin = (userData: { username: string; role: string; full_name: string; token: string }) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return (
      <LangProvider>
        <Login onLogin={handleLogin} />
      </LangProvider>
    );
  }

  return (
    <LangProvider>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)' },
        }}
      />
      <WebSocketListener />
      <Router>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customer" element={<CustomerApp />} />
            <Route path="/tasks" element={<TaskManager />} />
            <Route path="/parking" element={<ParkingSystem />} />
            <Route path="/shops" element={<Shops />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/settings" element={<Settings onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </Router>
    </LangProvider>
  );
}

export default App;
