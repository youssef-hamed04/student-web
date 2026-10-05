'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Avatar, Button, Card, CardTitle } from '@/components/ui/core';
import { AppShell, InlineError, PageHeader } from '@/components/ui/feedback';
import { Input } from '@/components/ui/forms';
import { InfoIcon } from '@/components/ui/icons';
import { useUpdateProfile } from '@/features/api';
import { updateProfileSchema } from '@/features/schemas';
import { api } from '@/lib/api-client';
import { useSession, useTranslation } from '@/lib/session-context';
import { toast } from '@/store/stores';

export default function EditProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, status, refresh } = useSession();
  const mutation = useUpdateProfile();
  const [formError, setFormError] = React.useState<unknown>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<{ fullName: string }>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: (user?.fullName ?? '') as string },
  });

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
      await refresh();
      toast.success(t('profile.profileUpdated'));
      router.back();
    } catch (e) {
      setFormError(e);
    }
  });

  const changeAvatar = async (file: File) => {
    setAvatarBusy(true);
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
      toast.success(t('profile.profileUpdated'));
    } catch (e) {
      setFormError(e);
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await api.put('profile/avatar', { avatarUrl: null });
      await refresh();
      toast.success(t('profile.profileUpdated'));
    } catch (e) {
      setFormError(e);
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!user) return null;

  return (
    <AppShell>
      <PageHeader
        title={t('profile.editProfile')}
        breadcrumbs={[{ href: '/profile', label: t('profile.title') }, { label: t('profile.editProfile') }]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardTitle>{t('profile.accountInfo')}</CardTitle>

          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user.fullName} uri={user.avatarUrl} size={72} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={avatarBusy}
                onClick={() => fileRef.current?.click()}
              >
                {t('profile.changePhoto')}
              </Button>
              {user.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => void removeAvatar()}
                >
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
          </div>

          {formError ? (
            <div className="mt-4">
              <InlineError error={formError} />
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4 border-t border-border pt-5">
            <Controller
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <Input
                  label={t('auth.fullName')}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={form.formState.errors.fullName ? t('validation.required') : undefined}
                  required
                />
              )}
            />
            <Button type="submit" loading={mutation.isPending}>
              {t('common.save')}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>{t('settings.account')}</CardTitle>
            <p className="text-[13px] text-muted">{t('profile.contactToChange')}</p>
            <ul className="mt-4 space-y-3 border-t border-border pt-4">
              {[t('profile.accountInfo'), t('profile.academicInfo'), t('auth.gender')].map((label) => (
                <li key={label} className="flex items-start gap-2.5 text-[13px] font-semibold">
                  <InfoIcon size={16} className="mt-0.5 text-primary-ink" />
                  <span className="min-w-0">{label}</span>
                </li>
              ))}
              <li className="flex items-start gap-2.5 text-[13px] font-semibold text-primary-ink">
                <InfoIcon size={16} className="mt-0.5" />
                <span className="min-w-0">{t('auth.contactAdmin')}</span>
              </li>
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-[13px] text-muted">{t('auth.reviewNote')}</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
