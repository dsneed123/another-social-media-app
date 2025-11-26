import { create } from 'zustand';
import storage from '../utils/storage';
import api from '../services/api';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      await storage.setItem('auth_token', response.token);
      await storage.setItem('user', JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
    } catch (error) {
      throw error;
    }
  },

  signup: async (username: string, email: string, password: string) => {
    try {
      const response = await api.signup(username, email, password);
      await storage.setItem('auth_token', response.token);
      await storage.setItem('user', JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    await api.logout();
    await storage.deleteItem('auth_token');
    await storage.deleteItem('user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  loadStoredAuth: async () => {
    try {
      const token = await storage.getItem('auth_token');
      const userStr = await storage.getItem('user');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        api.setToken(token);
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
      set({ isLoading: false });
    }
  },

  updateUser: (updates: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      set({ user: updatedUser });
      storage.setItem('user', JSON.stringify(updatedUser));
    }
  },
}));
