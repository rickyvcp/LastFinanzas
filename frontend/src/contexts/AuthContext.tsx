import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, setToken, loadToken } from '../api/client';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  auth_provider: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  processSessionId: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const tok = await loadToken();
      if (!tok) { setUser(null); return; }
      const r = await api.get('/auth/me');
      setUser(r.data);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (sessionId: string) => {
    try {
      setLoading(true);
      const r = await api.post('/auth/google/session', { session_id: sessionId });
      await setToken(r.data.token);
      setUser(r.data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cold-start: read hash/query for session_id (web) or deep link (mobile)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash || '';
          const search = window.location.search || '';
          const m = hash.match(/session_id=([^&]+)/) || search.match(/session_id=([^&]+)/);
          if (m) {
            await processSessionId(decodeURIComponent(m[1]));
            try { window.history.replaceState({}, '', window.location.pathname); } catch {}
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial) {
            const m = initial.match(/session_id=([^&]+)/);
            if (m) { await processSessionId(decodeURIComponent(m[1])); return; }
          }
        }
        await refreshMe();
      } catch (e) {
        console.warn('[Auth] init error', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [processSessionId, refreshMe]);

  // Hot links
  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      const m = url.match(/session_id=([^&]+)/);
      if (m) await processSessionId(decodeURIComponent(m[1]));
    });
    return () => sub.remove();
  }, [processSessionId]);

  const login = async (email: string, password: string) => {
    const r = await api.post('/auth/login', { email, password });
    await setToken(r.data.token);
    setUser(r.data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const r = await api.post('/auth/register', { email, password, name });
    await setToken(r.data.token);
    setUser(r.data.user);
  };

  const loginWithGoogle = async () => {
    const redirect = Platform.OS === 'web'
      ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/`
      : Linking.createURL('/');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;

    if (Platform.OS === 'web') {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
    if (result.type === 'success' && result.url) {
      const m = result.url.match(/session_id=([^&]+)/);
      if (m) await processSessionId(decodeURIComponent(m[1]));
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, loginWithGoogle, processSessionId, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
}
