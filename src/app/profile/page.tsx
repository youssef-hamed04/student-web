'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Avatar, Badge, Button, Card, CardTitle, KeyValue, Skeleton, Stat } from '@/components/ui/core';
import { AppShell, ErrorState, PageHeader } from '@/components/ui/feedback';
import {
  AwardIcon,
  BookIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  LogOutIcon,
  PencilIcon,
} from '@/components/ui/icons';
import { useHomeFeed, useProfile, useUnreadCount } from '@/features/api';
import { api } from '@/lib/api-client';
import { formatCompact, formatDate, formatDuration, localizedName, maskPhone } from '@/lib/format';
import { useSession, useTranslation } from '@/lib/session-context';
import { toast } from '@/store/stores';

export default function ProfilePage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { user, status, refresh, signOut } = useSession();
  const profileQuery = useProfile();
  const feed = useHomeFeed();
  const unread = useUnreadCount(status === 'authenticated');

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const [avatarError, setAvatarError] = React.useState<unknown>(null);

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const changeAvatar = async (file: File) => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const presign = await api.post<{ uploadUrl: string; objectKey: string }>('storage/uploads/avatar', {
        contentType: file.type,
        filename: file.name,
      });
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed');
      await api.put('profile/avatar', { avatarUrl: presign.objectKey });
      await refresh();
      await profileQuery.refetch();
      toast.success(t('profile.profileUpdated'));
    } catch (e) {
      setAvatarError(e);
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await api.put('profile/avatar', { avatarUrl: null });
      await refresh();
      await profileQuery.refetch();
      toast.success(t('profile.profileUpdated'));
    } catch (e) {
      setAvatarError(e);
    } finally {
      setAvatarBusy(false);
    }
  };

  if (status === 'loading' || profileQuery.isLoading) {
    return (
      <AppShell>
        <div className="flex animate-pulse flex-col gap-6">
          <div className="h-10 w-64 rounded-lg bg-surface-alt" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-64 rounded-xl bg-surface-alt" />
            <div className="h-64 rounded-xl bg-surface-alt" />
          </div>
        </div>
      </AppShell>
    );
  }

  const profile = profileQuery.data;

  if (profileQuery.isError || !profile) {
    return (
      <AppShell>
        <ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
      </AppShell>
    );
  }

  const fullName = profile.fullName || user?.fullName || '';
  const phone = profile.phone || user?.phone || '';
  const stats = feed.data?.stats;

  return (
    <AppShell unread={unread.data?.count ?? 0}>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('web.profileSubtitle')}
        action={
          <Link
            href="/profile/edit"
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-fg transition-colors hover:brightness-110"
          >
            <PencilIcon size={15} />
            {t('profile.editProfile')}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardTitle
              action={<Badge label={profile.status} tone={profile.status === 'ACTIVE' ? 'success' : 'warning'} />}
            >
              {t('profile.accountInfo')}
            </CardTitle>
            <KeyValue label={t('auth.fullName')}>{fullName}</KeyValue>
            <KeyValue label={t('auth.phone')}>
              <span dir="ltr">{maskPhone(phone)}</span>
            </KeyValue>
            <KeyValue label={t('web.col.date')}>{formatDate(profile.createdAt, language)}</KeyValue>
          </Card>

          <Card>
            <CardTitle>{t('profile.academicInfo')}</CardTitle>
            <KeyValue label={t('auth.university')}>{localizedName(profile.university, language)}</KeyValue>
            <KeyValue label={t('auth.faculty')}>{localizedName(profile.faculty, language)}</KeyValue>
            <KeyValue label={t('auth.department')}>{localizedName(profile.department, language)}</KeyValue>
            <KeyValue label={t('auth.academicYear')}>{localizedName(profile.academicYear, language)}</KeyValue>
            <KeyValue label={t('auth.gender')}>{t(profile.gender === 'MALE' ? 'auth.male' : 'auth.female')}</KeyValue>
          </Card>

          <Card>
            <CardTitle>{t('web.quickLinks')}</CardTitle>
            <div className="-mx-1">
              {[
                { href: '/profile/edit', label: t('profile.editProfile') },
                { href: '/settings/security', label: t('settings.security') },
                { href: '/settings', label: t('settings.title') },
              ].map((row) => (
                <Link
                  key={row.href}
                  href={row.href}
                  className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 text-[13px] font-semibold transition-colors hover:bg-surface-alt"
                >
                  {row.label}
                  <ChevronRightIcon size={15} className="text-subtle" />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                if (window.confirm(t('auth.logoutConfirmTitle'))) void signOut();
              }}
            >
              <LogOutIcon size={17} />
              {t('auth.logout')}
            </Button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar name={fullName} uri={profile.avatarUrl ?? user?.avatarUrl} size={88} />
              <h2 className="mt-3 text-[15px] font-bold">{fullName}</h2>
              <p className="mt-0.5 text-[13px] text-muted" dir="ltr">
                {maskPhone(phone)}
              </p>
              <p className="mt-0.5 text-[13px] text-subtle">
                {t('profile.memberSince', {
                  date: formatDate(profile.createdAt, language),
                })}
              </p>
            </div>

            {avatarError ? (
              <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                {avatarError instanceof Error ? avatarError.message : t('errors.genericBody')}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-4">
              <Button variant="secondary" size="sm" loading={avatarBusy} onClick={() => fileRef.current?.click()}>
                {t('profile.changePhoto')}
              </Button>
              {profile.avatarUrl ? (
                <Button variant="ghost" size="sm" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                  {t('profile.removePhoto')}
                </Button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={avatarBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void changeAvatar(f);
                }}
              />
            </div>
          </Card>

          <Card>
            <CardTitle>{t('web.myLearning')}</CardTitle>
            {feed.isLoading ? (
              <div className="space-y-3">
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
                <Skeleton height={64} />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Stat
                  icon={<BookIcon size={19} />}
                  tone="primary"
                  label={t('home.stats.courses')}
                  value={formatCompact(stats?.enrolledCourses ?? 0, language)}
                />
                <Stat
                  icon={<CheckCircleIcon size={19} />}
                  tone="success"
                  label={t('home.stats.lessons')}
                  value={formatCompact(stats?.completedLessons ?? 0, language)}
                />
                <Stat
                  icon={<ClockIcon size={19} />}
                  label={t('home.stats.watchTime')}
                  value={formatDuration(stats?.watchTimeSeconds ?? 0, language)}
                />
                <Stat
                  icon={<AwardIcon size={19} />}
                  tone="warning"
                  label={t('home.stats.streak')}
                  value={formatCompact(stats?.streakDays ?? 0, language)}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
