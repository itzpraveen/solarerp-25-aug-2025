'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type Toast = {
  id: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  variant?: 'default' | 'success' | 'error';
  durationMs?: number;
};

type ToastCtx = {
  toast: (t: Omit<Toast, 'id'>) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [list, setList] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setList((l) => l.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID();
      const duration = t.durationMs ?? 3500;
      setList((l) => [...l, { ...t, id }]);
      if (duration > 0) setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Toasts container */}
      <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-[92vw] max-w-sm flex-col gap-2 md:top-20">
        {list.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-lg)] backdrop-blur-sm',
              'animate-in slide-in-from-right-5 fade-in-0 duration-200',
              t.variant === 'error'
                ? 'border-[var(--danger-100)] bg-[var(--danger-50)]/95 text-[var(--danger-700)] dark:border-[var(--danger-100)]/30 dark:bg-[var(--danger-50)]/20 dark:text-[var(--danger-600)]'
                : t.variant === 'success'
                  ? 'border-[var(--success-100)] bg-[var(--success-50)]/95 text-[var(--success-700)] dark:border-[var(--success-100)]/30 dark:bg-[var(--success-50)]/20 dark:text-[var(--success-600)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)]/95 text-[var(--text-primary)]',
            ].join(' ')}
          >
            {t.title && <div className="font-semibold">{t.title}</div>}
            {t.description && (
              <div className="mt-0.5 text-sm opacity-90">{t.description}</div>
            )}
            {t.actionLabel && t.onAction && (
              <div className="mt-3">
                <button
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-subtle)] transition-colors"
                  onClick={async () => {
                    await t.onAction!();
                    remove(t.id);
                  }}
                >
                  {t.actionLabel}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
