import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setCsrfToken } from '../api/client.js';

const AuthContext = createContext(null);
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const timeoutRef = useRef(1800);
  const lastActivity = useRef(Date.now());

  const applySession = useCallback((data) => {
    setCsrfToken(data?.csrf_token);
    if (data?.session_timeout) timeoutRef.current = data.session_timeout;
    setUser(data?.user ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      applySession(data);
      if (data.session_expired) setNotice('Your session expired due to inactivity. Please log in again.');
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauth = (e) => {
      setUser(null);
      if (e.detail?.code === 'session_expired') setNotice('Your session expired due to inactivity. Please log in again.');
    };
    window.addEventListener('auth:unauthenticated', onUnauth);
    return () => window.removeEventListener('auth:unauthenticated', onUnauth);
  }, []);

  const logout = useCallback(async (message = '') => {
    try {
      const res = await api.post('/auth/logout');
      setCsrfToken(res.data?.csrf_token);
    } catch {
      setCsrfToken(null);
    }
    setUser(null);
    setNotice(message);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    touch();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > timeoutRef.current * 1000) {
        logout('You were logged out after a period of inactivity to protect your medical information.');
      }
    }, 15000);
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, touch));
      clearInterval(timer);
    };
  }, [user, logout]);

  const login = useCallback(
    async (email, password, remember) => {
      const res = await api.post('/auth/login', { email, password, remember });
      applySession(res.data);
      setNotice('');
      return res.data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post('/auth/register', payload);
      if (res.data?.user) applySession(res.data);
      return res;
    },
    [applySession]
  );

  const value = useMemo(
    () => ({ user, loading, notice, setNotice, login, logout, register, refresh }),
    [user, loading, notice, login, logout, register, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
