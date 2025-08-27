import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import AppHeader from '~/components/AppHeader';
import CommandPalette from '~/components/CommandPalette';
import AuthGuard from '~/components/AuthGuard';
import ToastProvider from '~/components/ui/ToastProvider';
import ConfirmProvider from '~/components/ui/ConfirmProvider';
import KeyboardShortcuts from '~/components/KeyboardShortcuts';

export const metadata: Metadata = {
  title: 'SolarERP (Kerala) – MVP',
  description: 'Minimal ERP for a solo solar entrepreneur in Kerala',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
          (function() {
            try {
              var stored = localStorage.getItem('theme');
              var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              var theme = stored === 'dark' || (!stored && prefersDark) ? 'dark' : 'light';
              if (theme === 'dark') document.documentElement.classList.add('dark');
            } catch (e) {}
          })();
        `}
        </Script>
        <AuthGuard />
        <ToastProvider>
          <ConfirmProvider>
            <div className="min-h-screen">
              <AppHeader />
              <KeyboardShortcuts />
              <CommandPalette />
              <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            </div>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
