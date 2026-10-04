'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { SessionProvider } from '@/lib/session-context';
import { useLanguageStore, useThemeStore, useUiStore } from '@/store/stores';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => {
        const status = (err as { status?: number })?.status ?? 0;
        if (status >= 400 && status < 500) return false;
        return count < 1;
      },
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});

function ThemeAndDir({ children }: { children: React.ReactNode }) {
  const preference = useThemeStore((s) => s.preference);
  const language = useLanguageStore((s) => s.language);

  React.useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (preference === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const fn = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', fn);
      return () => mq.removeEventListener('change', fn);
    }
    apply(preference === 'dark');
  }, [preference]);

  React.useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  return <>{children}</>;
}

function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-start text-[13px] shadow-lg ${
            t.kind === 'success'
              ? 'border-success/40 bg-surface text-foreground'
              : t.kind === 'error'
                ? 'border-danger/40 bg-surface text-foreground'
                : 'border-border bg-surface text-foreground'
          }`}
        >
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              t.kind === 'success' ? 'bg-success' : t.kind === 'error' ? 'bg-danger' : 'bg-primary'
            }`}
          />
          {t.message}
        </button>
      ))}
    </div>
  );
}

export function Providers({
  initialUser,
  children,
}: {
  initialUser: { id: string; fullName: string; phone: string; role: string; status: string; avatarUrl?: string | null } | null;
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider initialUser={initialUser}>
        <ThemeAndDir>{children}</ThemeAndDir>
        <ToastHost />
      </SessionProvider>
    </QueryClientProvider>
  );
}
