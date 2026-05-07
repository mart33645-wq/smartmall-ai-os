import axios from 'axios';
import toast from 'react-hot-toast';

import { useStore, type AuthUser } from '../store/useStore';
import { getStoredLang } from '../i18n/runtimeText';

const USER_STORAGE_KEY = 'smartmall_user';
const DEFAULT_BACKEND_PORT = '8010';
const LOCAL_BROWSER_HOSTS = new Set(['127.0.0.1', 'localhost']);
const VERCEL_BACKEND_ORIGIN = 'https://smartmall-backend.vercel.app';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
  }

  const { protocol, hostname, origin } = window.location;

  if (LOCAL_BROWSER_HOSTS.has(hostname)) {
    return `${protocol}//${hostname}:${DEFAULT_BACKEND_PORT}`;
  }

  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.ammartahoun.online')) {
    return VERCEL_BACKEND_ORIGIN;
  }

  return origin;
};

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl(),
);

export const WS_BASE_URL = API_BASE_URL.replace(/^http/i, 'ws');

export const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
export const wsUrl = (path = '/ws') => `${WS_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const getStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
};

const clearStoredSession = () => {
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }

  useStore.getState().setUser(null);
};

const getAccessToken = () => getStoredUser()?.token;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = String(err.config?.url || '');

    if (err.response?.status === 401 && !url.includes('/api/auth/login')) {
      clearStoredSession();
      toast.error(
        getStoredLang() === 'ar'
          ? 'انتهت الجلسة، يتم الآن إعادة تفعيل الدخول التلقائي'
          : 'Session expired, auto sign-in will be retried',
      );
    } else if (err.response?.data?.detail) {
      toast.error(err.response.data.detail);
    } else {
      toast.error(
        err.message ||
          (getStoredLang() === 'ar'
            ? 'حدث خطأ غير متوقع أثناء الاتصال بالخادم'
            : 'An unexpected error occurred while contacting the server'),
      );
    }

    return Promise.reject(err);
  },
);
