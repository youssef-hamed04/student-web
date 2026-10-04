'use client';

import * as React from 'react';

import { translate, type Language } from '@/i18n/dictionaries';
import { useLanguageStore } from '@/store/stores';

interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
}

interface SessionContextValue {
  user: SessionUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue>({
  user: null,
  status: 'loading',
  refresh: async () => {},
  signOut: async () => {},
});

export function useSession() {
  return React.useContext(SessionContext);
}

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = React.useState<SessionUser | null>(initialUser);
  const [status, setStatus] = React.useState<SessionContextValue['status']>(
    initialUser ? 'authenticated' : 'loading'
  );

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      const body = await res.json();
      const next = (body?.data ?? null) as SessionUser | null;
      setUser(next);
      setStatus(next ? 'authenticated' : 'unauthenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  React.useEffect(() => {
    if (!initialUser) void refresh();
  }, [initialUser, refresh]);

  const signOut = React.useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // best-effort
    }
    setUser(null);
    setStatus('unauthenticated');
    window.location.href = '/login';
  }, []);

  const value = React.useMemo(
    () => ({ user, status, refresh, signOut }),
    [user, status, refresh, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language]
  );
  return { t, language: language as Language };
}
