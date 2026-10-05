'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';

import { Avatar, Badge, Button, Card, CardTitle, KeyValue, ProgressBar, Segmented } from '@/components/ui/core';
import { AppShell, ErrorState, PageHeader } from '@/components/ui/feedback';
import { Input, Sheet } from '@/components/ui/forms';
import { CheckIcon, ClockIcon, FileIcon, LayersIcon, LockIcon, PlayIcon, UserIcon } from '@/components/ui/icons';
import { useCourse, useCourseParts, useEnroll, useJoinOptions, useRedeemCourseCode, useValidateCode } from '@/features/api';
import { accessCodeSchema } from '@/features/schemas';
import { formatCompact, formatDate, formatDuration, formatMoney, formatNumber, localizedName } from '@/lib/format';
import { useTranslation } from '@/lib/session-context';
import { cn } from '@/lib/utils';
import { toast } from '@/store/stores';
import type { Language } from '@/i18n/dictionaries';
import type { CourseDetail, CourseJoinOptions, CoursePart, CourseSection, LessonSummary } from '@/types/domain';

type Tab = 'overview' | 'content' | 'materials';

interface OutlineGroup {
  key: string;
  title: string;
  owned: boolean;
  sections: CourseSection[];
}

function buildGroups(
  course: CourseDetail,
  parts: CoursePart[] | undefined,
  language: Language
): OutlineGroup[] {
  const source = parts ?? [];
  const fallback: OutlineGroup[] = [{ key: 'all', title: '', owned: false, sections: course.sections }];
  if (source.length === 0) return fallback;

  const byTitle = new Map(course.sections.map((s) => [s.title, s]));
  const groups: OutlineGroup[] = source.map((p) => ({
    key: p.id,
    title: localizedName({ name: p.title, nameAr: p.titleAr }, language),
    owned: p.owned,
    sections: p.sections
      .map((ps) => byTitle.get(ps.title))
      .filter((s): s is CourseSection => !!s),
  }));
  const matched = groups.reduce((n, g) => n + g.sections.length, 0);
  return matched === 0 ? fallback : groups;
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t, language } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>('overview');
  const [joinOpen, setJoinOpen] = React.useState(false);
  const query = useCourse(id);
  const partsQuery = useCourseParts(id);
  const course = query.data;

  if (query.isLoading) {
    return (
      <AppShell>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="mb-6 h-8 w-1/3 animate-pulse rounded-lg bg-surface-alt" />
            <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-alt" />
            <div className="mt-6 h-40 w-full animate-pulse rounded-xl bg-surface-alt" />
          </div>
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-xl bg-surface-alt" />
            <div className="h-72 animate-pulse rounded-xl bg-surface-alt" />
          </div>
        </div>
      </AppShell>
    );
  }
  if (query.isError || !course) {
    return (
      <AppShell>
        <PageHeader title={t('courses.title')} back />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </AppShell>
    );
  }

  const hasAccess = course.access.state === 'ACTIVE';

  const openLesson = (lesson: LessonSummary) => {
    if (lesson.locked && !lesson.isPreview) {
      toast.info(t('access.lockedBody'));
      if (course.access.state === 'NOT_ENROLLED') setJoinOpen(true);
      return;
    }
    router.push(`/lessons/${lesson.id}`);
  };

  const continueLearning = () => {
    const target = course.progress?.lastLessonId ?? course.sections.find((s) => !s.locked)?.lessons[0]?.id;
    if (target) router.push(`/lessons/${target}`);
    else toast.info(t('courses.empty.sectionsBody'));
  };

  const groups = buildGroups(course, partsQuery.data?.hasParts ? partsQuery.data.parts : [], language);
  const currentLessonId = course.progress?.lastLessonId ?? null;

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <PageHeader
            title={course.title}
            subtitle={course.teacher.fullName}
            breadcrumbs={[
              { href: '/courses', label: t('tabs.courses') },
              { label: course.title },
            ]}
            meta={
              <>
                {course.university ? <Badge label={localizedName(course.university, language)} tone="info" /> : null}
                {course.academicYear ? <Badge label={localizedName(course.academicYear, language)} tone="primary" /> : null}
                {hasAccess ? <Badge label={t('access.joinedTitle')} tone="success" /> : null}
                {course.access.state === 'PENDING_APPROVAL' || course.access.state === 'PENDING_PAYMENT' ? (
                  <Badge label={t('access.pendingTitle')} tone="warning" />
                ) : null}
                <Badge label={formatDuration(course.totalDurationSeconds, language)} />
                {course.studentCount ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                    <UserIcon size={15} />
                    {formatCompact(course.studentCount, language)}
                  </span>
                ) : null}
              </>
            }
          />

          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-alt">
            {course.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-surface text-subtle">
                <LayersIcon size={26} />
              </span>
            )}
          </div>

          <div className="mt-6">
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'overview', label: t('courses.overview') },
                { value: 'content', label: t('courses.content') },
                { value: 'materials', label: t('courses.materials') },
              ]}
            />
          </div>

          <div className="mt-4">
            {tab === 'overview' ? (
              <div className="flex flex-col gap-4">
                <Card>
                  {course.shortDescription ? (
                    <p className="text-sm leading-relaxed text-muted">{course.shortDescription}</p>
                  ) : null}
                  <h3 className={cn('font-bold', course.shortDescription ? 'mt-5' : undefined)}>{t('courses.aboutCourse')}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{course.description}</p>
                </Card>

                {course.outcomes.length > 0 ? (
                  <Card>
                    <h3 className="text-[15px] font-bold">{t('courses.whatYouLearn')}</h3>
                    <ul className="mt-3 flex flex-col gap-2">
                      {course.outcomes.map((o) => (
                        <li key={o} className="flex items-start gap-2.5 text-sm text-muted">
                          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                            <CheckIcon size={12} />
                          </span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}

                {course.requirements.length > 0 ? (
                  <Card>
                    <h3 className="text-[15px] font-bold">{t('courses.requirements')}</h3>
                    <ul className="mt-3 flex flex-col gap-2">
                      {course.requirements.map((r) => (
                        <li key={r} className="flex items-start gap-2.5 text-sm text-muted">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}

                <Card>
                  <h3 className="text-[15px] font-bold">{t('courses.instructor')}</h3>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar name={course.teacher.fullName} uri={course.teacher.avatarUrl} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{course.teacher.fullName}</div>
                      {course.teacher.title ? <div className="truncate text-[13px] text-muted">{course.teacher.title}</div> : null}
                    </div>
                  </div>
                </Card>

                <p className="text-[13px] text-subtle">{t('courses.lastUpdated', { date: formatDate(course.updatedAt, language) })}</p>
              </div>
            ) : null}

            {tab === 'content' ? (
              course.sections.length === 0 ? (
                <Card>
                  <p className="py-6 text-center text-sm text-muted">{t('courses.empty.sectionsBody')}</p>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {course.sections.map((s) => (
                    <details key={s.id} className="overflow-hidden rounded-xl border border-border bg-surface" open={!s.locked}>
                      <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-bold">
                        {s.locked ? <LockIcon size={16} className="text-subtle" /> : <PlayIcon size={16} className="text-primary" />}
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <span className="shrink-0 text-[13px] font-normal text-muted">{formatNumber(s.lessonCount, language)}</span>
                      </summary>
                      <div className="border-t border-border">
                        {s.lessons.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => openLesson(l)}
                            className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-start text-sm transition-colors last:border-0 hover:bg-surface-alt"
                          >
                            <span className="w-4 shrink-0 text-center">
                              {l.progress?.completed ? (
                                <CheckIcon size={15} className="text-success" />
                              ) : l.locked && !l.isPreview ? (
                                <LockIcon size={14} className="text-subtle" />
                              ) : (
                                <PlayIcon size={13} className="text-primary" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{l.title}</span>
                            {l.isPreview ? <Badge label={t('courses.preview')} tone="info" /> : null}
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )
            ) : null}

            {tab === 'materials' ? (
              <Card padded={false}>
                {course.attachments.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">{t('lesson.noAttachments')}</p>
                ) : (
                  course.attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => router.push(a.locked && !hasAccess ? `/courses/${course.id}` : `/viewer/${a.id}`)}
                      className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-start text-sm transition-colors last:border-0 hover:bg-surface-alt"
                    >
                      <FileIcon size={17} className="shrink-0 text-subtle" />
                      <span className="min-w-0 flex-1 truncate">{a.title}</span>
                      {a.locked && !hasAccess ? <LockIcon size={15} className="shrink-0 text-subtle" /> : null}
                    </button>
                  ))
                )}
              </Card>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <EnrollmentCard course={course} onJoin={() => setJoinOpen(true)} onContinue={continueLearning} />

          <Card>
            <CardTitle action={<span className="text-[13px] font-semibold text-muted">{formatNumber(course.lessonCount, language)}</span>}>
              {t('web.curriculum')}
            </CardTitle>
            {groups.length === 0 || groups.every((g) => g.sections.length === 0) ? (
              <p className="py-4 text-center text-[13px] text-muted">{t('courses.empty.sectionsBody')}</p>
            ) : (
              <div className="-mx-1 flex flex-col">
                {groups.map((g, gi) => (
                  <div key={g.key} className={cn('px-1', gi > 0 && 'mt-3')}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-bold uppercase tracking-wider text-muted">
                        {g.title || t('web.curriculum')}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {g.owned ? <Badge label={t('library.owned')} tone="success" /> : null}
                        <span className="text-[13px] font-semibold text-subtle">
                          {g.sections.reduce((n, s) => n + s.lessonCount, 0)}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      {g.sections.map((s) => (
                        <div key={s.id} className="flex flex-col">
                          <div className="flex items-center gap-2 px-2 pb-1 pt-2 text-[13px] font-semibold text-foreground">
                            {s.locked ? <LockIcon size={14} className="shrink-0 text-subtle" /> : null}
                            <span className="min-w-0 flex-1 truncate">{s.title}</span>
                            <span className="shrink-0 text-subtle">{formatNumber(s.lessonCount, language)}</span>
                          </div>
                          {s.lessons.map((l) => (
                            <Link
                              key={l.id}
                              href={`/lessons/${l.id}`}
                              aria-current={l.id === currentLessonId ? 'page' : undefined}
                              onClick={(e) => {
                                if (l.locked && !l.isPreview) {
                                  e.preventDefault();
                                  openLesson(l);
                                }
                              }}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-alt',
                                l.id === currentLessonId && 'bg-primary-soft font-semibold text-primary'
                              )}
                            >
                              <span className="w-4 shrink-0 text-center">
                                {l.progress?.completed ? (
                                  <CheckIcon size={14} className="text-success" />
                                ) : l.locked && !l.isPreview ? (
                                  <LockIcon size={13} className="text-subtle" />
                                ) : (
                                  <PlayIcon size={12} className="text-subtle" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{l.title}</span>
                              {l.isPreview ? <Badge label={t('courses.preview')} tone="info" /> : null}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>

      <JoinSheet courseId={course.id} open={joinOpen} onClose={() => setJoinOpen(false)} />
    </AppShell>
  );
}

function EnrollmentCard({
  course,
  onJoin,
  onContinue,
}: {
  course: CourseDetail;
  onJoin: () => void;
  onContinue: () => void;
}) {
  const { t, language } = useTranslation();
  const state = course.access.state;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        {/*
          A student who already holds the course is told what their access is
          worth in time, not in money — the mobile panel does the same. Leaving
          the price here read as an outstanding charge on a course they had
          already paid for.
        */}
        {state === 'ACTIVE' ? (
          <span className="text-[13px] font-semibold text-muted">
            {course.access.expiresAt
              ? t('access.expiresOn', { date: formatDate(course.access.expiresAt, language) })
              : t('access.lifetimeAccess')}
          </span>
        ) : course.isFree || !course.price ? (
          <Badge label={t('common.free')} tone="success" />
        ) : (
          <span className="text-xl font-bold tracking-tight">{formatMoney(course.price, language)}</span>
        )}
      </div>

      <div className="mt-3">
        <KeyValue label={t('courses.content')}>{formatNumber(course.lessonCount, language)}</KeyValue>
        <KeyValue label={t('web.col.duration')}>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon size={14} className="text-subtle" />
            {formatDuration(course.totalDurationSeconds, language)}
          </span>
        </KeyValue>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-4">
        <Avatar name={course.teacher.fullName} uri={course.teacher.avatarUrl} size={36} />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{course.teacher.fullName}</div>
          {course.teacher.title ? <div className="truncate text-[13px] text-muted">{course.teacher.title}</div> : null}
        </div>
      </div>

      {course.progress && state === 'ACTIVE' ? (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 text-[13px] font-semibold text-muted">{t('courses.yourProgress')}</div>
          <ProgressBar percent={course.progress.percent} showLabel />
        </div>
      ) : null}

      <div className="mt-4">
        {state === 'ACTIVE' ? (
          <Button fullWidth size="lg" onClick={onContinue}>
            {t('access.joinedTitle')} · {t('common.continue')}
          </Button>
        ) : state === 'PENDING_APPROVAL' ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5 text-[13px]">
            <strong>{t('access.pendingTitle')}</strong>
            <p className="mt-1 text-muted">{t('access.pendingBody')}</p>
          </div>
        ) : (
          <Button fullWidth size="lg" onClick={onJoin}>
            {t('access.join')}
          </Button>
        )}
      </div>
    </Card>
  );
}

function JoinSheet({ courseId, open, onClose }: { courseId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const options = useJoinOptions(courseId, open);
  const enroll = useEnroll(courseId);
  const redeem = useRedeemCourseCode(courseId);
  const validate = useValidateCode();
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const data: CourseJoinOptions | undefined = options.data;

  const doEnroll = async (method: 'FREE' | 'PAYMENT' | 'CODE' | 'ADMIN_APPROVAL') => {
    setError(null);
    try {
      const res = await enroll.mutateAsync(method);
      toast.success(t(res.state === 'ACTIVE' ? 'access.joinedTitle' : 'access.pendingTitle'));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const doRedeem = async () => {
    const parsed = accessCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setError(t('validation.codeFormat'));
      return;
    }
    setError(null);
    try {
      const res = await redeem.mutateAsync(parsed.data.code);
      toast.success(t(res.state === 'ACTIVE' ? 'access.joinedTitle' : 'access.pendingTitle'));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('access.joinTitle')}>
      {options.isLoading ? (
        <p className="py-8 text-center text-sm text-muted">{t('common.loading')}</p>
      ) : options.isError || !data ? (
        <ErrorState error={options.error} compact />
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">{t('access.joinIntro')}</p>
          {data.enrollmentMethods.includes('FREE') ? (
            <Button fullWidth onClick={() => void doEnroll('FREE')} loading={enroll.isPending}>{t('access.joinFree')}</Button>
          ) : null}
          {data.enrollmentMethods.includes('ADMIN_APPROVAL') ? (
            <Button fullWidth variant="secondary" onClick={() => void doEnroll('ADMIN_APPROVAL')} loading={enroll.isPending}>{t('access.methodApproval')}</Button>
          ) : null}
          {data.enrollmentMethods.includes('PAYMENT') ? (
            <Button fullWidth variant="secondary" onClick={() => void doEnroll('PAYMENT')} loading={enroll.isPending}>{t('access.methodPayment')}</Button>
          ) : null}
          <div className="rounded-lg border border-border bg-surface-alt/60 p-3">
            <Input label={t('access.codeLabel')} placeholder={t('access.codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} dir="ltr" />
            {validate.data ? <p className="mt-1 text-[13px] text-muted">{validate.data.course?.title}</p> : null}
            <Button fullWidth className="mt-2" loading={redeem.isPending} onClick={doRedeem}>{t('access.redeem')}</Button>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {data.enrollmentMethods.length === 0 && !data.methods.accessCode ? (
            <p className="text-sm text-muted">{t('access.noMethods')}</p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}