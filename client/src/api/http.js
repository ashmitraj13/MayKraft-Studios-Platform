import axios from 'axios';

const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const API_ORIGIN = base || window.location.origin;

const http = axios.create({ baseURL: `${base}/api`, timeout: 20000 });

const STORAGE_KEY = 'mks_auth';
export function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}
export function storeAuth(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

http.interceptors.request.use((config) => {
  const auth = readStoredAuth();
  if (auth?.token) config.headers.Authorization = `Bearer ${auth.token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const isLogin = err.config?.url?.includes('/auth/login');
    if (status === 401 && !isLogin) onUnauthorized();
    const message = err.response?.data?.message || (err.code === 'ECONNABORTED' ? 'The server took too long to respond' : err.message === 'Network Error' ? 'Cannot reach the server' : 'Something went wrong');
    err.userMessage = message;
    return Promise.reject(err);
  }
);

export default http;
