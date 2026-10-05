'use client';

import { useParams } from 'next/navigation';
import * as React from 'react';

import { FocusShell, ErrorState } from '@/components/ui/feedback';
import { useAttachmentTicket } from '@/features/api';
import { ProtectedPdf } from '@/components/documents/ProtectedPdf';
import { useTranslation } from '@/lib/session-context';

export default function ViewerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t } = useTranslation();
  const query = useAttachmentTicket(id, true);

  React.useEffect(() => {
    const onCopy = (e: ClipboardEvent) => e.preventDefault();
    const onContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('copy', onCopy);
    document.addEventListener('contextmenu', onContext);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('contextmenu', onContext);
    };
  }, []);

  return (
    <FocusShell title={t('courses.materials')}>
      {query.isLoading ? (
        <p className="py-20 text-center text-sm text-muted">{t('player.authorizing')}</p>
      ) : query.isError || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ViewerBody url={query.data.url} headers={query.data.headers} watermark={`${query.data.watermark.primary}`} />
      )}
    </FocusShell>
  );
}

function ViewerBody({ url, watermark }: { url: string; headers?: Record<string, string>; watermark: string }) {
  const { t } = useTranslation();
  const base = (url.split('?')[0] ?? '').toLowerCase();
  const isPdf = base.endsWith('.pdf');
  const isImage = /\.(png|jpe?g|webp|gif)$/.test(base);
  if (isPdf) {
    // Same reasoning as the Library reader: an iframe hands the document to the
    // browser's PDF viewer, Download button and all.
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface-alt p-3" style={{ minHeight: '72vh' }}>
        <ProtectedPdf url={url} watermark={watermark} />
      </div>
    );
  }
  if (isImage) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-alt">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="attachment" className="mx-auto max-h-[75vh] select-none" draggable={false} />
        <span className="pointer-events-none absolute bottom-4 end-4 select-none rounded bg-black/40 px-2 py-1 text-[11px] text-white">{watermark}</span>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-fg transition hover:brightness-110"
    >
      {t('common.continue')}
    </a>
  );
}
