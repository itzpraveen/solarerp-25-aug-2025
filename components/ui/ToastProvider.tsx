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
            className={
              'pointer-events-auto rounded border px-3 py-2 text-sm shadow-sm backdrop-blur ' +
              (t.variant === 'error'
                ? 'border-red-200 bg-red-50/95 text-red-800 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200'
                : t.variant === 'success'
                  ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200'
                  : 'border-gray-200 bg-white/95 text-gray-800 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-100')
            }
          >
            {t.title && <div className="font-medium">{t.title}</div>}
            {t.description && (
              <div className="text-xs opacity-90">{t.description}</div>
            )}
            {t.actionLabel && t.onAction && (
              <div className="mt-2">
                <button
                  className="rounded border px-2 py-1 text-xs dark:border-gray-700"
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
