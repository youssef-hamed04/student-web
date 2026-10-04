import type { Metadata, Viewport } from 'next';

import { getSessionUser } from '@/lib/session';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Student Center',
  description: 'Student learning platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <Providers initialUser={user}>{children}</Providers>
      </body>
    </html>
  );
}
