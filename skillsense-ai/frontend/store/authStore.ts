// frontend/store/authStore.ts
// Zustand auth store — handles login, register, logout, and session rehydration.

import { create } from 'zustand';
import api from '../lib/api';
import { setTokens, removeTokens } from '../lib/auth';

export type UserRole = 'student' | 'institute' | 'industry' | 'government' | 'admin';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  authProvider?: 'local' | 'google' | 'github';
  isActive: boolean;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken:
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
  loading: false,
  error: null,

  // ── Login ─────────────────────────────────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      // Backend returns { success, data: { user, token }, message }
      const { user, token, accessToken, refreshToken } = data.data;
      const jwt = token ?? accessToken; // support both field names
      setTokens(jwt, refreshToken);
      // Mirror to localStorage for the sidebar display
      if (typeof window !== 'undefined') {
        localStorage.setItem('ss_user', JSON.stringify({ name: user.name, role: user.role, email: user.email }));
      }
      set({ user, accessToken: jwt, loading: false });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Login failed. Please check your credentials.';
      set({ loading: false, error: message });
      throw err;
    }
  },

  // ── Register ──────────────────────────────────────────────────────────────
  register: async (name: string, email: string, password: string, role: UserRole) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', { name, email, password, role });
      const { user, token, accessToken, refreshToken } = data.data;
      const jwt = token ?? accessToken;
      setTokens(jwt, refreshToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ss_user', JSON.stringify({ name: user.name, role: user.role, email: user.email }));
      }
      set({ user, accessToken: jwt, loading: false });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Registration failed. Please try again.';
      set({ loading: false, error: message });
      throw err;
    }
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors — still clear local state
    } finally {
      removeTokens();
      set({ user: null, accessToken: null });
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    }
  },

  // ── Check Auth (rehydrate on page load) ───────────────────────────────────
  checkAuth: async () => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('accessToken') || localStorage.getItem('token'))
      : null;
    if (!token) return;

    set({ loading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data, accessToken: token, loading: false });
    } catch {
      removeTokens();
      localStorage.removeItem('token');
      set({ user: null, accessToken: null, loading: false });
    }
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  clearError: () => set({ error: null }),

  // ── setToken (used by OAuth callback) ─────────────────────────────────────
  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('token', token);
    }
    set({ accessToken: token });
  },
}));
