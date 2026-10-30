import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(cfg => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export interface AuthUser {
  access_token: string;
  role: 'admin' | 'customer' | 'technician';
  user_id: number;
  full_name: string;
  email?: string;
  technician_id: number | null;
}

const KEY = 'dg_auth';

export function saveAuth(u: AuthUser) { localStorage.setItem(KEY, JSON.stringify(u)); }
export function getAuth(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function getToken(): string | null { return getAuth()?.access_token ?? null; }
export function clearAuth() { localStorage.removeItem(KEY); }

export async function loginApi(email: string, password: string): Promise<AuthUser> {
  const form = new URLSearchParams({ username: email, password });
  const { data } = await axios.post<AuthUser>(`${API_URL}/api/auth/login`, form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

export async function registerApi(payload: {
  email: string; password: string; full_name: string; phone?: string; role: string;
}): Promise<AuthUser> {
  const { data } = await axios.post<AuthUser>(`${API_URL}/api/auth/register`, payload);
  return data;
}
