'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
};

type CtxType = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const Ctx = createContext<CtxType | null>(null);

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

export default function ConfirmProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<
    null | (ConfirmOptions & { id: string; resolve: (v: boolean) => void })
  >(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const id = crypto.randomUUID();
      setState({ id, resolve, ...opts });
    });
  }, []);

  const onClose = useCallback(
    (ok: boolean) => {
      if (!state) return;
      const { resolve } = state;
      setState(null);
      resolve(ok);
    },
    [state],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/70"
            onClick={() => onClose(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-lg)] animate-in fade-in-0 zoom-in-95 duration-200">
            {state.title && (
              <div className="text-base font-semibold text-[var(--text-primary)]">{state.title}</div>
            )}
            {state.description && (
              <div className="mt-2 text-sm text-[var(--text-secondary)]">
                {state.description}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] transition-all"
                onClick={() => onClose(false)}
              >
                {state.cancelText ?? 'Cancel'}
              </button>
              <button
                className={[
                  'rounded-lg px-4 py-2 text-sm font-medium text-white transition-all',
                  state.variant === 'danger'
                    ? 'bg-[var(--danger-600)] hover:bg-[var(--danger-700)] hover:shadow-md'
                    : 'bg-[var(--primary-600)] hover:bg-[var(--primary-700)] hover:shadow-md',
                ].join(' ')}
                onClick={() => onClose(true)}
              >
                {state.confirmText ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
