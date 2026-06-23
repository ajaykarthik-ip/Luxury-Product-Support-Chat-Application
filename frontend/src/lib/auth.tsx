'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { disconnectSocket } from './socket';
import type { Role, User } from './types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean; // true until we've read localStorage on first mount
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    role: Role;
  }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Holds the logged-in user + JWT, persisted to localStorage so a refresh keeps
 * you signed in. Wraps the whole app (mounted in the root layout).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on first load.
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  function persist(res: { accessToken: string; user: User }) {
    localStorage.setItem('token', res.accessToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }

  async function login(email: string, password: string) {
    return persist(await api.login({ email, password }));
  }

  async function register(data: {
    email: string;
    password: string;
    name: string;
    role: Role;
  }) {
    return persist(await api.register(data));
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Client-side route guard. Redirects to /login if signed out, or to the user's
 * own home if they hit a page for the wrong role.
 */
export function useRequireAuth(requiredRole?: Role) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Send to the matching portal so a logged-out agent doesn't land on the
      // customer sign-in (and vice-versa).
      router.replace(requiredRole === 'AGENT' ? '/agent/login' : '/login');
    } else if (requiredRole && user.role !== requiredRole) {
      router.replace(user.role === 'AGENT' ? '/agent' : '/products');
    }
  }, [user, loading, requiredRole, router]);

  return { user, loading };
}
