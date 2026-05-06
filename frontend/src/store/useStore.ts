import { create } from 'zustand';

export interface Shop {
  id: number;
  name: string;
  category: string;
  floor: number;
  rent_amount: number;
  is_at_risk: boolean;
  daily_revenue: number;
  visitor_count: number;
  performance_score: number;
  updated_at?: string | null;
}

export interface Alert {
  id: number;
  type: string;   // CRITICAL | WARNING | INFO
  message: string;
  zone: string;
  is_resolved: boolean;
  created_at: string;
}

export interface ParkingSlot {
  id: number;
  slot_number: string;
  level?: number;
  is_occupied: boolean;
  type: string; // Standard | EV | Disabled
}

export interface ParkingStats {
  total: number;
  occupied: number;
  available: number;
  occupancy_pct: number;
  ev_total: number;
  ev_occupied: number;
  prediction_next_hour: number;
  status: string;
}

export interface AnalyticsOverview {
  total_revenue: number;
  total_visitors: number;
  avg_performance: number;
  shops_at_risk: number;
  active_alerts: number;
  parking_occupancy: number;
  total_shops: number;
}

export interface AuthUser {
  username: string;
  role: string;
  full_name: string;
  token: string;
}

interface SmartMallState {
  // Auth
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;

  // Shops
  shops: Shop[];
  setShops: (shops: Shop[]) => void;
  updateShop: (id: number, data: Partial<Shop>) => void;
  addShop: (shop: Shop) => void;
  removeShop: (id: number) => void;

  // Alerts
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  resolveAlert: (id: number) => void;
  removeAlert: (id: number) => void;

  // Parking
  parkingSlots: ParkingSlot[];
  setParkingSlots: (slots: ParkingSlot[]) => void;
  toggleParkingSlot: (id: number) => void;
  mergeParkingSlot: (slot: Partial<ParkingSlot> & { id: number }) => void;
  parkingStats: ParkingStats | null;
  setParkingStats: (stats: ParkingStats) => void;

  // Analytics
  analytics: AnalyticsOverview | null;
  setAnalytics: (data: AnalyticsOverview) => void;

  // UI
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<SmartMallState>((set) => ({
  // Auth
  user: (() => {
    try {
      const stored = localStorage.getItem('smartmall_user');
      if (stored) return JSON.parse(stored);
      return null;
    } catch { return null; }
  })(),
  setUser: (user) => {
    if (user) localStorage.setItem('smartmall_user', JSON.stringify(user));
    else localStorage.removeItem('smartmall_user');
    set({ user });
  },

  // Shops
  shops: [],
  setShops: (shops) => set({ shops }),
  updateShop: (id, data) => set((state) => ({
    shops: state.shops.map(s => s.id === id ? { ...s, ...data } : s),
  })),
  addShop: (shop) => set((state) => ({ shops: [...state.shops, shop] })),
  removeShop: (id) => set((state) => ({ shops: state.shops.filter(s => s.id !== id) })),

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
  resolveAlert: (id) => set((state) => ({
    alerts: state.alerts.map(a => a.id === id ? { ...a, is_resolved: true } : a),
  })),
  removeAlert: (id) => set((state) => ({ alerts: state.alerts.filter(a => a.id !== id) })),

  // Parking
  parkingSlots: [],
  setParkingSlots: (slots) => set({ parkingSlots: slots }),
  toggleParkingSlot: (id) => set((state) => ({
    parkingSlots: state.parkingSlots.map(s => s.id === id ? { ...s, is_occupied: !s.is_occupied } : s),
  })),
  mergeParkingSlot: (slot) => set((state) => ({
    parkingSlots: state.parkingSlots.some(s => s.id === slot.id)
      ? state.parkingSlots.map(s => (s.id === slot.id ? { ...s, ...slot } : s))
      : [...state.parkingSlots, slot as ParkingSlot],
  })),
  parkingStats: null,
  setParkingStats: (stats) => set({ parkingStats: stats }),

  // Analytics
  analytics: null,
  setAnalytics: (data) => set({ analytics: data }),

  // UI
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}));
