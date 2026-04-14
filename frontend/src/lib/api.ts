import axios from 'axios';

import type { AuthUser } from '../store/useStore';

const USER_STORAGE_KEY = 'smartmall_user';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8000';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000`;
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
      try {
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      window.location.reload();
    }
    return Promise.reject(err);
  },
);
