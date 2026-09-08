import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { authService, clearStoredToken, decodeToken, getStoredToken, isTokenExpired, saveToken } from '../services/authService';
import { registerOn401Handler } from '../services/api';
import type { AppUser } from '../types';

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Prevent concurrent logout calls (e.g., multiple 401s in flight)
  const loggingOut = useRef(false);

  const logout = useCallback(() => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    clearStoredToken();
    setUser(null);
    loggingOut.current = false;
  }, []);

  // Restore session from cookie on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      const payload = decodeToken(token);
      if (payload && !isTokenExpired(payload)) {
        setUser({ email: payload.sub, role: payload.role });
      } else {
        clearStoredToken();
      }
    }
    setIsLoading(false);
  }, []);

  // Register a 401 handler so expired tokens trigger logout automatically
  useEffect(() => {
    registerOn401Handler(logout);
  }, [logout]);

  // Detect cookie removal or expiry without a network request
  const checkSession = useCallback(() => {
    const token = getStoredToken();
    if (!token) {
      if (user) logout();
      return;
    }
    const payload = decodeToken(token);
    if (!payload || isTokenExpired(payload)) {
      logout();
    }
  }, [user, logout]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(checkSession, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [checkSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authService.login(email, password);
    saveToken(data.token);
    setUser({ email: data.email, role: data.role });
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
