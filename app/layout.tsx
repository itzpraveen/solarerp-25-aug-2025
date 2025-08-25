import './globals.css';
import type { Metadata } from 'next';
import AppHeader from '~/components/AppHeader';
import AuthGuard from '~/components/AuthGuard';

export const metadata: Metadata = {
  title: 'SolarERP (Kerala) – MVP',
  description: 'Minimal ERP for a solo solar entrepreneur in Kerala',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard />
        <div className="min-h-screen">
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
