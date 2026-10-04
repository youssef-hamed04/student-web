'use client';

import Link from 'next/link';

import { Card } from '@/components/ui/core';
import { ArrowRightIcon, InfoIcon, LifeBuoyIcon } from '@/components/ui/icons';
import { useTranslation } from '@/lib/session-context';

const primaryLink =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-fg transition-colors hover:brightness-110';

export default function PasswordHelpPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="mx-auto w-full max-w-lg">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-black text-primary-fg">S</span>
          <span className="text-[15px] font-bold tracking-tight">{t('common.appName')}</span>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">{t('auth.passwordHelpTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('auth.passwordHelpBody')}</p>

        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-border bg-surface-alt/60 p-3.5">
          <InfoIcon size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="text-[13px] text-muted">
            <p className="font-bold text-foreground">{t('auth.contactAdmin')}</p>
            <p className="mt-0.5">{t('auth.passwordHelpNote')}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/support/new" className={primaryLink}>
            <LifeBuoyIcon size={18} />
            {t('settings.contactSupport')}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold transition-colors hover:bg-surface-alt"
          >
            {t('auth.login')}
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </Card>
    </div>
  );
}